"""
Design Planner Agent — GPT-4o receives the original room image + user
constraints and returns a structured redesign plan: exactly 3 furniture
items to replace (with detailed descriptions for searching Romanian stores)
plus decor suggestions the renderer will add via AI.

This agent does NOT generate images — it only plans.
"""
from __future__ import annotations

import json
import logging

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

from app.models.schemas import DesignPlan, GraphState, JobStatus, PlannedItem

logger = logging.getLogger(__name__)

PLANNER_SYSTEM = """\
You are a world-class interior designer analyzing a real room photo.
You will return a detailed list of specific design suggestions.

RETURN ONLY VALID JSON with this structure:
{
  "suggestions": [
    {
      "item_type": "<puff|lamp|rug|plant|cushion|art|etc>",
      "description": "<very detailed description for product search>",
      "placement": "<exact placement in room, e.g. 'between desk and window'>",
      "colors": ["<color1>", "<color2>"],
      "style_vibe": "<cozy|modern|luxury|minimalist|scandinavian>",
      "specific_details": "<very specific details like 'umbrella-shaped', 'soft fabric', 'metal frame'>",
      "is_replacement": true/false,
      "target_furniture": "<if replacement, which furniture it replaces>",
      "search_keywords": ["<romanian keyword>", "<keyword>"]
    }
  ],
  "overall_vision": "<2-3 sentence design rationale>"
}

RULES:
1. Provide 5-8 specific design suggestions (mix of replacements and add-ons)
2. Each suggestion MUST have:
   - Specific COLOR(s)
   - Exact PLACEMENT in the room
   - Clear STYLE VIBE
   - Very DETAILED description for product search
3. For replacements (is_replacement: true):
   - target_furniture must be the exact furniture being replaced
   - Only suggest replacements if user didn't mark them as "keep"
4. For add-ons (is_replacement: false):
   - focus on decorative items, lighting, textiles, plants, art
   - be very specific about WHERE and WHAT COLOR
5. Search keywords must be in Romanian language
6. No markdown fences, ONLY valid JSON
""".strip()


def _build_planner_prompt(state: GraphState) -> str:
    """Build the user message for the planner."""
    analysis = state.room_analysis
    style = state.desired_style.value
    kept = state.furniture_to_keep

    return f"""
Analyze this room photo and create a redesign plan.

Room Analysis (from previous scan):
- Room type: {analysis.room_type}
- Lighting: {analysis.lighting}
- Current furniture: {', '.join(f.name for f in analysis.detected_furniture)}
- Spatial notes: {analysis.spatial_notes}

User Constraints:
- Desired style: {style}
- Furniture to KEEP (do NOT replace these): {', '.join(kept) if kept else 'none — you may replace anything'}
- Budget limit: {f'{state.max_budget:.0f} RON' if state.max_budget else 'no limit'}
- Additional notes: {state.user_notes or 'none'}

Study the photo, then return the JSON redesign plan with exactly 3 items to replace.
""".strip()


def _build_image_content(state: GraphState) -> dict:
    """Return the image content block for GPT-4o vision."""
    if state.image_url:
        return {
            "type": "image_url",
            "image_url": {"url": state.image_url, "detail": "high"},
        }
    b64 = state.image_base64
    if not b64.startswith("data:"):
        b64 = f"data:image/jpeg;base64,{b64}"
    return {
        "type": "image_url",
        "image_url": {"url": b64, "detail": "high"},
    }


def design_planner_node(state: GraphState) -> GraphState:
    """LangGraph node — creates detailed design suggestions from the room image."""
    logger.info("Design Planner starting (job=%s)", state.job_id)
    state.status = JobStatus.PLANNING

    llm = ChatOpenAI(model="gpt-4o", temperature=0.7, max_tokens=2000)

    image_content = _build_image_content(state)
    message = HumanMessage(
        content=[
            {"type": "text", "text": PLANNER_SYSTEM},
            image_content,
            {"type": "text", "text": _build_planner_prompt(state)},
        ]
    )

    try:
        response = llm.invoke([message])
        raw_text = response.content.strip()

        # Strip markdown fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]

        import json
        parsed = json.loads(raw_text)

        # Parse the new suggestion structure
        from app.models.schemas import DesignSuggestion
        
        suggestions = []
        for sugg_data in parsed.get("suggestions", []):
            # Sanitize None values to empty strings/defaults
            sugg = DesignSuggestion(
                item_type=sugg_data.get("item_type") or "",
                description=sugg_data.get("description") or "",
                placement=sugg_data.get("placement") or "",
                colors=sugg_data.get("colors") or [],
                style_vibe=sugg_data.get("style_vibe") or "",
                specific_details=sugg_data.get("specific_details") or "",
                is_replacement=sugg_data.get("is_replacement") or False,
                target_furniture=sugg_data.get("target_furniture") or "",
                search_keywords=sugg_data.get("search_keywords") or [],
            )
            suggestions.append(sugg)

        state.design_plan = DesignPlan(
            suggestions=suggestions,
            overall_vision=parsed.get("overall_vision", ""),
        )

        logger.info(
            "Design Planner done — %d suggestions: %s",
            len(suggestions),
            [f"{s.item_type} ({s.placement})" for s in suggestions],
        )

    except (json.JSONDecodeError, KeyError) as exc:
        logger.exception("Design Planner parse error")
        state.status = JobStatus.FAILED
        state.error = f"Design Planner failed: {exc}"

    return state
