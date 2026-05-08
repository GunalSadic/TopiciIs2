"""
Agent 2 — Interior Designer
Consumes the RoomAnalysis + user constraints, produces a DALL-E 3 prompt,
then calls DALL-E 3 to generate the render.
"""
from __future__ import annotations

import logging

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from openai import OpenAI

from app.models.schemas import DesignProposal, GraphState, JobStatus, MatchedProduct

logger = logging.getLogger(__name__)

STYLE_GUIDANCE: dict[str, str] = {
    "Modern": (
        "clean lines, neutral palette (whites, grays, blacks), statement lighting, "
        "open floor plan feel, minimal clutter, mixed materials (glass + metal + wood)"
    ),
    "Minimalist": (
        "bare essentials only, monochromatic whites and beiges, hidden storage, "
        "uncluttered surfaces, natural materials, zen-like calm"
    ),
    "Luxury": (
        "rich materials (marble, velvet, brass), dramatic lighting, art pieces, "
        "deep jewel tones or champagne/gold accents, bespoke furniture silhouettes"
    ),
    "Scandinavian": (
        "hygge warmth, light oak wood tones, soft textiles (wool, linen), "
        "white walls with pops of muted pastels, functional minimalism, houseplants"
    ),
    "Gaming Room": (
        "RGB accent lighting, dark walls, ergonomic gaming chair, multi-monitor setup, "
        "cable management, LED strip lights, neon signage, sleek desk"
    ),
}

DESIGNER_SYSTEM = """\
You are a world-class interior designer. Given a room analysis and user constraints,
you will do two things:

1. Write a hyper-detailed DALL-E 3 image generation prompt (no longer than 300 words).
   The prompt must describe: room layout, all kept furniture placed naturally, new furniture
   additions, color palette, lighting, materials, style, time of day, camera angle
   (eye-level perspective shot), photo-realistic quality cues.

2. Write a short 2-3 sentence "design_rationale" explaining your choices to the homeowner.

Return ONLY valid JSON with keys: "image_prompt" and "design_rationale".
No markdown, no extra text.
"""


def _build_designer_prompt(state: GraphState) -> str:
    analysis = state.room_analysis
    style = state.desired_style.value
    style_desc = STYLE_GUIDANCE.get(style, "")

    kept = [f.name for f in analysis.detected_furniture if f.keep]
    removed = [f.name for f in analysis.detected_furniture if not f.keep]

    # Override "keep" list with explicit user selection when provided
    if state.furniture_to_keep:
        kept = state.furniture_to_keep

    # Include real sourced products so DALL-E renders them by description
    product_lines = []
    for mp in state.sourced_products:
        product_lines.append(
            f"- {mp.slot}: {mp.name} ({mp.store}, {mp.price:.0f} RON)"
        )
    products_section = "\n".join(product_lines) if product_lines else "none (use generic furniture matching the style)"

    return f"""
Room Analysis:
- Room type: {analysis.room_type}
- Lighting: {analysis.lighting}
- Spatial notes: {analysis.spatial_notes}
- Description: {analysis.raw_description}

User Constraints:
- Desired style: {style} — {style_desc}
- Furniture to KEEP (must appear in render): {', '.join(kept) or 'none specified'}
- Furniture to REPLACE/REMOVE: {', '.join(removed) or 'none specified'}
- Additional notes: {state.user_notes or 'none'}

REAL PRODUCTS TO FEATURE (from Romanian stores — describe these items accurately in the render):
{products_section}

Generate the DALL-E 3 prompt and design rationale as JSON.
The design rationale should mention the real product names and their stores if available.
""".strip()


def interior_designer_node(state: GraphState) -> GraphState:
    """LangGraph node — mutates and returns state."""
    logger.info("Agent 2 — Interior Designer starting (job=%s)", state.job_id)
    state.status = JobStatus.RENDERING

    # ------------------------------------------------------------------ #
    # Step 1: GPT-4o generates the structured DALL-E prompt               #
    # ------------------------------------------------------------------ #
    import json

    llm = ChatOpenAI(model="gpt-4o", temperature=0.7, max_tokens=800)
    messages = [
        SystemMessage(content=DESIGNER_SYSTEM),
        HumanMessage(content=_build_designer_prompt(state)),
    ]

    try:
        response = llm.invoke(messages)
        raw_text = response.content.strip()

        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]

        parsed = json.loads(raw_text)
        image_prompt = parsed.get("image_prompt", "")
        rationale = parsed.get("design_rationale", "")

    except (json.JSONDecodeError, KeyError) as exc:
        logger.exception("Agent 2 prompt-generation error")
        state.status = JobStatus.FAILED
        state.error = f"Interior Designer failed: {exc}"
        return state

    # ------------------------------------------------------------------ #
    # Step 2: DALL-E 3 renders the room                                   #
    # ------------------------------------------------------------------ #
    try:
        client = OpenAI()
        dalle_response = client.images.generate(
            model="dall-e-3",
            prompt=image_prompt,
            size="1792x1024",     # landscape — best for room renders
            quality="hd",
            n=1,
        )
        image_url = dalle_response.data[0].url
        revised_prompt = dalle_response.data[0].revised_prompt or image_prompt

        total = sum(p.price for p in state.sourced_products)
        state.design_proposal = DesignProposal(
            image_prompt=image_prompt,
            design_rationale=rationale,
            generated_image_url=image_url,
            revised_prompt=revised_prompt,
            matched_products=state.sourced_products,
            suggestions=state.alternative_products,
            total_price=total,
        )
        state.status = JobStatus.COMPLETED
        logger.info("Agent 2 done — image generated (job=%s)", state.job_id)

    except Exception as exc:
        logger.exception("DALL-E 3 generation error")
        state.status = JobStatus.FAILED
        state.error = f"Image generation failed: {exc}"

    return state
