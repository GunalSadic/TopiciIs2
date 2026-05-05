"""
Agent 1 — Vision Analyzer
Receives the room image and returns a structured RoomAnalysis.
Uses GPT-4o with vision capability.
"""
from __future__ import annotations

import base64
import json
import logging

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

from app.models.schemas import DetectedFurniture, GraphState, JobStatus, RoomAnalysis

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are an expert interior designer's AI assistant with deep knowledge in room spatial analysis.
Analyze the provided room photo and return ONLY a valid JSON object — no markdown fences, no prose.

JSON schema:
{
  "room_type": "<bedroom|living room|office|dining room|bathroom|other>",
  "detected_furniture": [
    {
      "name": "<item name>",
      "keep": true,
      "condition": "<good|fair|poor>",
      "estimated_position": "<e.g. center-left, against north wall>"
    }
  ],
  "spatial_notes": "<windows, doors, approximate room size, architectural features>",
  "lighting": "<natural|artificial|dark|mixed>",
  "raw_description": "<2-3 sentence prose summary of the room>"
}

Be thorough: list every piece of furniture you can identify.
Estimate condition based on visible wear, style obsolescence, and quality cues.
"""


def _build_image_content(state: GraphState) -> dict:
    """Return the correct image content block regardless of input type."""
    if state.image_url:
        return {
            "type": "image_url",
            "image_url": {"url": state.image_url, "detail": "high"},
        }
    # base64 path
    if not state.image_base64.startswith("data:"):
        data_url = f"data:image/jpeg;base64,{state.image_base64}"
    else:
        data_url = state.image_base64
    return {
        "type": "image_url",
        "image_url": {"url": data_url, "detail": "high"},
    }


def vision_analyzer_node(state: GraphState) -> GraphState:
    """LangGraph node — mutates and returns state."""
    logger.info("Agent 1 — Vision Analyzer starting (job=%s)", state.job_id)
    state.status = JobStatus.ANALYZING

    llm = ChatOpenAI(model="gpt-4o", temperature=0, max_tokens=1500)

    image_content = _build_image_content(state)
    message = HumanMessage(
        content=[
            {"type": "text", "text": SYSTEM_PROMPT},
            image_content,
        ]
    )

    try:
        response = llm.invoke([message])
        raw_text = response.content.strip()

        # Strip markdown code fences if the model adds them anyway
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]

        parsed = json.loads(raw_text)

        furniture = [
            DetectedFurniture(
                name=item.get("name", "unknown"),
                keep=item.get("keep", True),
                condition=item.get("condition", "good"),
                estimated_position=item.get("estimated_position", ""),
            )
            for item in parsed.get("detected_furniture", [])
        ]

        state.room_analysis = RoomAnalysis(
            room_type=parsed.get("room_type", ""),
            detected_furniture=furniture,
            spatial_notes=parsed.get("spatial_notes", ""),
            lighting=parsed.get("lighting", ""),
            raw_description=parsed.get("raw_description", ""),
        )
        logger.info(
            "Agent 1 done — room_type=%s, furniture_count=%d",
            state.room_analysis.room_type,
            len(furniture),
        )

    except (json.JSONDecodeError, KeyError) as exc:
        logger.exception("Agent 1 parse error")
        state.status = JobStatus.FAILED
        state.error = f"Vision Analyzer failed to parse response: {exc}"

    return state
