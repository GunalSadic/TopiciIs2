"""
Iterative Renderer Agent — Uses OpenAI's image editing (gpt-image-1)
to modify the original room photo one product at a time.

Flow:
  1. Take original room image + product 1 image → "replace X with this product"
  2. Take result + product 2 image → "now replace Y with this product"
  3. Take result + product 3 image → "now replace Z with this product"
  4. Take result → "add these decor touches" (no product image, just text)

Each step preserves the room layout, walls, floor, lighting — only the
target furniture piece changes.

Falls back to DALL-E 3 text-only generation if gpt-image-1 is unavailable.
"""
from __future__ import annotations

import base64
import logging
from io import BytesIO

from openai import OpenAI

from app.models.schemas import (
    DesignPlan,
    DesignProposal,
    GraphState,
    JobStatus,
    MatchedProduct,
)

logger = logging.getLogger(__name__)


def _b64_to_png_bytes(b64_string: str) -> bytes:
    """Convert a base64 string (no prefix) to PNG bytes via Pillow."""
    from PIL import Image

    raw = base64.b64decode(b64_string)
    img = Image.open(BytesIO(raw))

    # gpt-image-1 works best with PNG
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _edit_image_with_product(
    client: OpenAI,
    room_b64: str,
    product_b64: str,
    prompt: str,
) -> str:
    """
    Call OpenAI images.edit with gpt-image-1.
    Sends the room image + product image, returns the edited image as base64.
    """
    room_bytes = _b64_to_png_bytes(room_b64)
    product_bytes = _b64_to_png_bytes(product_b64)

    # Create in-memory file-like objects with names
    room_file = BytesIO(room_bytes)
    room_file.name = "room.png"
    product_file = BytesIO(product_bytes)
    product_file.name = "product.png"

    response = client.images.edit(
        model="gpt-image-1",
        image=[room_file, product_file],
        prompt=prompt,
        size="1536x1024",
        quality="high",
    )

    # gpt-image-1 returns base64 by default
    return response.data[0].b64_json


def _edit_image_text_only(
    client: OpenAI,
    room_b64: str,
    prompt: str,
) -> str:
    """
    Call OpenAI images.edit with just the room image and a text prompt
    (for adding decor without a product reference image).
    """
    room_bytes = _b64_to_png_bytes(room_b64)
    room_file = BytesIO(room_bytes)
    room_file.name = "room.png"

    response = client.images.edit(
        model="gpt-image-1",
        image=room_file,
        prompt=prompt,
        size="1536x1024",
        quality="high",
    )

    return response.data[0].b64_json


def _fallback_dalle3(
    client: OpenAI,
    room_description: str,
    plan: DesignPlan,
    products: list[MatchedProduct],
    style: str,
) -> tuple[str, str]:
    """
    Fallback: if gpt-image-1 fails, use DALL-E 3 text-only generation.
    Returns (image_url, b64) — b64 will be empty since DALL-E 3 returns URLs.
    """
    product_lines = []
    for p in products:
        product_lines.append(f"- {p.slot}: {p.name} from {p.store} ({p.description})")
    products_text = "\n".join(product_lines) if product_lines else "generic furniture"

    prompt = f"""Photorealistic interior design render of a {style} room.

IMPORTANT: Recreate this exact room layout: {room_description}

Replace furniture with these REAL products (describe them accurately):
{products_text}

Additional decor: {plan.overall_vision}

Photo-realistic, eye-level perspective, natural lighting, 8K quality.
The room layout, walls, floor, and windows must match the original exactly.
"""

    response = client.images.generate(
        model="dall-e-3",
        prompt=prompt[:4000],
        size="1792x1024",
        quality="hd",
        n=1,
    )

    return response.data[0].url, ""


def iterative_renderer_node(state: GraphState) -> GraphState:
    """
    LangGraph node — iteratively applies each sourced product to the room image.
    
    For each product (with its associated suggestion details):
    1. Send: current room image + product image
    2. Prompt: "Don't change layout at all, only [suggestion.description] with this product"
    3. Iterate until all products applied, then add decor
    """
    logger.info("Iterative Renderer starting (job=%s)", state.job_id)
    state.status = JobStatus.RENDERING

    client = OpenAI()
    plan = state.design_plan
    products = state.sourced_products
    style = state.desired_style.value

    # Start with the original room image
    current_image_b64 = state.image_base64
    render_steps: list[str] = []
    intermediate_images: list[str] = []
    intermediate_products: list[str] = []

    # Store original image as first intermediate
    intermediate_images.append(current_image_b64)
    intermediate_products.append("Original room")

    try:
        # ------------------------------------------------------------ #
        # Iterative rendering: apply each sourced product                #
        # ------------------------------------------------------------ #
        for iteration, product in enumerate(products, start=1):
            logger.info(
                "Iterative Renderer — Iteration %d/%d: applying %s (job=%s)",
                iteration, len(products), product.name, state.job_id,
            )

            # Find the matching suggestion for detailed context
            matching_suggestion = None
            for sugg in plan.suggestions:
                if sugg.placement.lower() in product.slot.lower() or product.slot.lower() in sugg.placement.lower():
                    matching_suggestion = sugg
                    break

            if not matching_suggestion:
                # Fallback: use product description
                specific_instruction = product.description
                placement = product.slot
            else:
                # Use exact suggestion details for the prompt
                specific_instruction = (
                    f"{matching_suggestion.item_type}: {matching_suggestion.description} "
                    f"({', '.join(matching_suggestion.colors)}). "
                    f"Details: {matching_suggestion.specific_details}. "
                    f"Style: {matching_suggestion.style_vibe}"
                )
                placement = matching_suggestion.placement

            # Use product image if available
            if product.image_base64:
                prompt = (
                    f"STRICTLY INPAINTING ONLY: ABSOLUTELY NO CHANGES to the room image, with the SINGLE EXCEPTION of placing the PROVIDED product image at {placement}.\n\n"
                    f"FORBIDDEN TO ALTER: The room layout, walls, floor, ceiling, windows, doors, existing furniture, textures, colors, or lighting must remain 100% IDENTICAL to the original image.\n\n"
                    f"NOTHING NOTHING ELSE: Do not adjust, modify, move, recolor, or change ANY detail or object other than the product being placed. Treat all other areas of the image as if they are carved in stone. Your only task is a seamless inpainting of the provided product into the specified area."
                )

                try:
                    result_b64 = _edit_image_with_product(
                        client, current_image_b64, product.image_base64, prompt
                    )
                    current_image_b64 = result_b64
                    # Store intermediate image
                    intermediate_images.append(current_image_b64)
                    intermediate_products.append(f"{product.name} ({product.store})")
                    logger.info(
                        "Iteration %d done — applied %s (job=%s)",
                        iteration, product.name, state.job_id,
                    )
                    render_steps.append(f"Applied: {product.name} ({product.store}) - {placement}")
                except Exception as exc:
                    logger.warning(
                        "Product edit failed at iteration %d: %s (job=%s). Continuing...",
                        iteration, exc, state.job_id,
                    )
            else:
                # No product image — use text-only edit with the specific instruction
                prompt = (
                    f"STRICTLY INPAINTING ONLY: ABSOLUTELY NO CHANGES to the room image, with the SINGLE EXCEPTION of adding this item at {placement}: {product.name}.\n\n"
                    f"FORBIDDEN TO ALTER: The room layout, walls, floor, ceiling, windows, doors, existing furniture, textures, colors, or lighting must remain 100% IDENTICAL to the original image.\n\n"
                    f"NOTHING NOTHING ELSE: Do not adjust, modify, move, recolor, or change ANY detail or object other than the item being placed. Treat all other areas of the image as if they are carved in stone. Your only task is a seamless inpainting of the specified item into the target area."
                )

                try:
                    result_b64 = _edit_image_text_only(
                        client, current_image_b64, prompt
                    )
                    current_image_b64 = result_b64
                    # Store intermediate image
                    intermediate_images.append(current_image_b64)
                    intermediate_products.append(f"{product.name}")
                    logger.info(
                        "Iteration %d done (text-only) — applied %s (job=%s)",
                        iteration, product.name, state.job_id,
                    )
                    render_steps.append(f"Applied: {product.name} - {placement}")
                except Exception as exc:
                    logger.warning(
                        "Text-only edit failed at iteration %d: %s (job=%s). Continuing...",
                        iteration, exc, state.job_id,
                    )

        # ------------------------------------------------------------ #
        # Final step: Add decor suggestions (from design plan)           #
        # ------------------------------------------------------------ #
        if plan.overall_vision:
            decor_prompt = (
                f"STRICTLY CONSERVATIVE DESIGN FINISH: Do NOT change, move, or modify ANY existing objects, furniture, or structures in the image.\n\n"
                f"FORBIDDEN TO ALTER: The room layout, walls, floor, ceiling, windows, doors, lighting, or ANY of the previously placed products must remain EXACTLY as they are.\n\n"
                f"SINGLE TASK: Only add new, subtle decorative elements that align with the provided design vision, placing them ONLY in empty spaces, on surfaces, or hanging from the ceiling without obscuring or changing anything already present. Treat all existing elements as permanent and untouchable."
            )

            try:
                result_b64 = _edit_image_text_only(
                    client, current_image_b64, decor_prompt
                )
                current_image_b64 = result_b64
                # Store final intermediate image
                intermediate_images.append(current_image_b64)
                intermediate_products.append("Final touches & design vision")
                logger.info("Final step done — added design vision touches (job=%s)", state.job_id)
                render_steps.append("Final touches: Design vision")
            except Exception as exc:
                logger.warning("Decor edit failed (continuing without): %s", exc)

        # ------------------------------------------------------------ #
        # Build final proposal                                          #
        # ------------------------------------------------------------ #
        total_price = sum(p.price for p in products)

        # Use data URL for the final image
        final_url = f"data:image/png;base64,{current_image_b64}"

        state.current_render_b64 = current_image_b64
        state.design_proposal = DesignProposal(
            design_rationale=plan.overall_vision,
            generated_image_url=final_url,
            generated_image_b64=current_image_b64,
            render_steps=render_steps,
            intermediate_images=intermediate_images,
            intermediate_products=intermediate_products,
            matched_products=products,
            suggestions=[],
            total_price=total_price,
        )
        state.status = JobStatus.COMPLETED
        logger.info(
            "Iterative Renderer done — completed %d iterations (job=%s)",
            len(products), state.job_id,
        )

    except Exception as exc:
        logger.exception("Iterative Renderer failed (job=%s)", state.job_id)

        # Try DALL-E 3 fallback
        logger.info("Attempting DALL-E 3 fallback (job=%s)...", state.job_id)
        try:
            fallback_url, _ = _fallback_dalle3(
                client,
                state.room_analysis.raw_description,
                plan,
                products,
                style,
            )
            total_price = sum(p.price for p in products)
            state.design_proposal = DesignProposal(
                design_rationale=plan.overall_vision + " (rendered with DALL-E 3 fallback)",
                generated_image_url=fallback_url,
                matched_products=products,
                suggestions=[],
                total_price=total_price,
                decor_description=plan.overall_vision,
                intermediate_images=[],
                intermediate_products=["DALL-E 3 fallback (no iterations)"],
            )
            state.status = JobStatus.COMPLETED
            logger.info("DALL-E 3 fallback succeeded (job=%s)", state.job_id)
        except Exception as fallback_exc:
            logger.exception("DALL-E 3 fallback also failed (job=%s)", state.job_id)
            state.status = JobStatus.FAILED
            state.error = f"Renderer failed: {exc}. Fallback also failed: {fallback_exc}"

    return state
