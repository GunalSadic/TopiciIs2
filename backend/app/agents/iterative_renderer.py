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


# ---------------------------------------------------------------------------
# Slot → English placement mapping (fixes Romanian slot names being passed
# directly to gpt-image-1 which doesn't understand them as locations)
# ---------------------------------------------------------------------------
_SLOT_TO_PLACEMENT: dict[str, tuple[str, bool]] = {
    # (placement_description, is_replacement)
    "sofa":         ("the main seating area, replacing the existing sofa", True),
    "canapea":      ("the main seating area, replacing the existing sofa/couch", True),
    "couch":        ("the main seating area, replacing the existing couch", True),
    "chair":        ("replacing the existing chair in the room", True),
    "scaun":        ("replacing the existing chair in the room", True),
    "armchair":     ("replacing the armchair in the room", True),
    "fotoliu":      ("replacing the armchair in the room", True),
    "table":        ("the center of the room, replacing the existing table", True),
    "masa":         ("the dining/coffee table area, replacing the existing table", True),
    "coffee table": ("in front of the sofa, replacing the existing coffee table", True),
    "desk":         ("the desk area, replacing the existing desk", True),
    "birou":        ("the desk area, replacing the existing desk", True),
    "bed":          ("the main sleeping area, replacing the existing bed", True),
    "pat":          ("the main sleeping area, replacing the existing bed", True),
    "wardrobe":     ("against the wall, replacing the existing wardrobe", True),
    "dulap":        ("against the wall, replacing the existing wardrobe", True),
    "cabinet":      ("against the wall, replacing the existing cabinet", True),
    "shelf":        ("mounted on the wall, replacing the existing shelf", True),
    "raft":         ("mounted on the wall, replacing the existing shelf", True),
    # Additions (not replacements) — placed in empty spaces
    "lamp":         ("in a corner or beside the sofa as a floor lamp", False),
    "lampa":        ("in a corner or beside the sofa as a floor lamp", False),
    "tablou":       ("hung on the largest empty wall, centered at eye level (approx. 150cm height), as framed wall art — apply correct wall perspective and lighting", False),
    "painting":     ("hung on the largest empty wall, centered at eye level, as framed wall art — apply correct wall perspective and lighting", False),
    "picture":      ("hung on the wall at eye level as framed wall art", False),
    "artwork":      ("hung on the wall at eye level as framed wall art", False),
    "mirror":       ("hung on the wall as a decorative mirror", False),
    "oglinda":      ("hung on the wall as a decorative mirror", False),
    "plant":        ("in a corner on the floor as an indoor potted plant", False),
    "planta":       ("in a corner on the floor as an indoor potted plant", False),
    "rug":          ("on the floor in the center of the seating area as a decorative rug", False),
    "covor":        ("on the floor in the center of the seating area as a decorative rug", False),
    "cushion":      ("on the sofa/chair as decorative cushions", False),
    "perna":        ("on the sofa/chair as decorative cushions", False),
}


def _resolve_placement(product: MatchedProduct, matching_suggestion: object | None) -> tuple[str, bool]:
    """
    Returns (placement_description, is_replacement) for building the edit prompt.
    Priority: matching suggestion > slot lookup table > generic fallback.
    """
    slot_lower = product.slot.lower().strip()

    if matching_suggestion is not None:
        is_repl = getattr(matching_suggestion, "is_replacement", True)
        placement = getattr(matching_suggestion, "placement", slot_lower)
        item_type = getattr(matching_suggestion, "item_type", slot_lower)
        if is_repl:
            return f"replacing the existing {item_type} — position: {placement}", True
        else:
            return f"adding to {placement}", False

    # Exact slot match
    if slot_lower in _SLOT_TO_PLACEMENT:
        return _SLOT_TO_PLACEMENT[slot_lower]

    # Partial match (e.g. "dining chair" → "chair")
    for key, value in _SLOT_TO_PLACEMENT.items():
        if key in slot_lower or slot_lower in key:
            return value

    # Generic fallback — assume replacement
    return f"replacing the existing {product.slot} in the room", True


def _preservation_block(placed_so_far: list[str]) -> str:
    """Returns a preservation clause listing all items already placed in prior steps."""
    if not placed_so_far:
        return ""
    lines = "\n".join(f"  • {item}" for item in placed_so_far)
    return (
        f"\n\nCRITICAL — ALREADY PLACED IN PREVIOUS STEPS (preserve their exact appearance, position, and quality):\n"
        f"{lines}\n"
        f"These items must look IDENTICAL to how they appear in the input image. Do NOT degrade, blur, recolor, or alter them in any way."
    )


def _build_prompt_with_image(
    placement: str,
    is_replacement: bool,
    product_name: str,
    placed_so_far: list[str] | None = None,
) -> str:
    """Build the gpt-image-1 edit prompt when a product reference image is provided."""
    if is_replacement:
        action = (
            f"REPLACE the existing furniture/object at: {placement}. "
            f"Use the EXACT product shown in the second image — replicate its shape, color, material and style faithfully. "
            f"Match the room's perspective, lighting and shadows."
        )
    else:
        action = (
            f"ADD the product shown in the second image to: {placement}. "
            f"Replicate the product's exact appearance from the reference image. "
            f"Integrate it naturally — match the room's perspective, scale, lighting and shadows."
        )

    preservation = _preservation_block(placed_so_far or [])

    return (
        f"Photo-realistic room editing task.\n\n"
        f"YOUR ONLY TASK: {action}\n\n"
        f"STRICT RULES — do NOT violate any of these:\n"
        f"- Do NOT change any other object, furniture piece, wall, floor, ceiling, window, door, or light source.\n"
        f"- Do NOT recolor, reposition, or alter anything outside the target area.\n"
        f"- The rest of the room must look 100% identical to the input image.\n"
        f"- The placed product must look photorealistic and physically plausible in the scene.\n"
        f"- Maintain full photographic sharpness and detail quality throughout the entire image.\n"
        f"- Product name for reference: {product_name}"
        f"{preservation}"
    )


def _build_prompt_text_only(
    placement: str,
    is_replacement: bool,
    product_name: str,
    placed_so_far: list[str] | None = None,
) -> str:
    """Build the gpt-image-1 edit prompt when NO product reference image is available."""
    if is_replacement:
        action = (
            f"REPLACE the existing furniture at: {placement} "
            f"with a photorealistic {product_name}. "
            f"Match the room's lighting, perspective and style."
        )
    else:
        action = (
            f"ADD a photorealistic {product_name} to: {placement}. "
            f"Integrate it naturally with correct perspective, scale, lighting and shadows."
        )

    preservation = _preservation_block(placed_so_far or [])

    return (
        f"Photo-realistic room editing task.\n\n"
        f"YOUR ONLY TASK: {action}\n\n"
        f"STRICT RULES:\n"
        f"- Do NOT change any other object, furniture, wall, floor, ceiling, window, or light.\n"
        f"- Everything outside the target area must remain 100% identical to the input image.\n"
        f"- The result must look photorealistic and physically plausible.\n"
        f"- Maintain full photographic sharpness and detail quality throughout the entire image."
        f"{preservation}"
    )


def iterative_renderer_node(state: GraphState) -> GraphState:
    """
    LangGraph node — iteratively applies each sourced product to the room image.
    """
    logger.info("Iterative Renderer starting (job=%s)", state.job_id)
    state.status = JobStatus.RENDERING

    client = OpenAI()
    plan = state.design_plan
    products = state.sourced_products
    style = state.desired_style.value

    current_image_b64 = state.image_base64
    render_steps: list[str] = []
    intermediate_images: list[str] = []
    intermediate_products: list[str] = []
    placed_so_far: list[str] = []  # tracks placed items for quality preservation prompts

    intermediate_images.append(current_image_b64)
    intermediate_products.append("Original room")

    try:
        for iteration, product in enumerate(products, start=1):
            logger.info(
                "Iterative Renderer — Iteration %d/%d: applying %s (slot=%s, job=%s)",
                iteration, len(products), product.name, product.slot, state.job_id,
            )

            # Match suggestion by item_type first (more reliable than placement string match)
            matching_suggestion = None
            slot_lower = product.slot.lower()
            for sugg in plan.suggestions:
                item_type_lower = sugg.item_type.lower()
                # Check item_type overlap with slot
                if (item_type_lower in slot_lower or slot_lower in item_type_lower or
                        any(word in slot_lower for word in item_type_lower.split() if len(word) >= 4)):
                    matching_suggestion = sugg
                    break

            placement, is_replacement = _resolve_placement(product, matching_suggestion)
            logger.info(
                "  → placement: %s | replacement: %s (job=%s)",
                placement, is_replacement, state.job_id,
            )

            if product.image_base64:
                prompt = _build_prompt_with_image(placement, is_replacement, product.name, placed_so_far)
                try:
                    result_b64 = _edit_image_with_product(
                        client, current_image_b64, product.image_base64, prompt
                    )
                    current_image_b64 = result_b64
                    intermediate_images.append(current_image_b64)
                    intermediate_products.append(f"{product.name} ({product.store})")
                    render_steps.append(f"Applied: {product.name} ({product.store}) — {placement}")
                    placed_so_far.append(f"{product.name} — {placement}")
                    logger.info("Iteration %d done — applied %s (job=%s)", iteration, product.name, state.job_id)
                except Exception as exc:
                    logger.warning(
                        "Product edit failed at iteration %d: %s (job=%s). Continuing...",
                        iteration, exc, state.job_id,
                    )
            else:
                prompt = _build_prompt_text_only(placement, is_replacement, product.name, placed_so_far)
                try:
                    result_b64 = _edit_image_text_only(client, current_image_b64, prompt)
                    current_image_b64 = result_b64
                    intermediate_images.append(current_image_b64)
                    intermediate_products.append(product.name)
                    render_steps.append(f"Applied (text-only): {product.name} — {placement}")
                    placed_so_far.append(f"{product.name} — {placement}")
                    logger.info("Iteration %d done (text-only) — applied %s (job=%s)", iteration, product.name, state.job_id)
                except Exception as exc:
                    logger.warning(
                        "Text-only edit failed at iteration %d: %s (job=%s). Continuing...",
                        iteration, exc, state.job_id,
                    )

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
