"""
LangGraph orchestration — Sourcing-First Iterative Pipeline:

  Vision Analyzer → Design Planner → Market Agent → Iterative Renderer

The flow:
  1. Vision Analyzer (GPT-4o): Analyzes the room photo, detects furniture
  2. Design Planner (GPT-4o): Looks at the image + analysis, picks 3 items
     to replace with detailed descriptions
  3. Market Agent: Searches Romanian stores for matching products,
     downloads their images
  4. Iterative Renderer (gpt-image-1): Edits the ORIGINAL room photo
     one product at a time, then adds AI decor
"""
from __future__ import annotations

import logging
from typing import Any, Literal

from langgraph.graph import END, START, StateGraph

from app.agents.vision_analyzer import vision_analyzer_node
from app.agents.design_planner import design_planner_node
from app.agents.market_agent import market_sourcing_node
from app.agents.iterative_renderer import iterative_renderer_node
from app.models.schemas import GraphState, JobStatus

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node wrappers — LangGraph 1.0 nodes must return dict[str, Any] updates
# ---------------------------------------------------------------------------

def _vision_wrapper(state: GraphState) -> dict[str, Any]:
    updated = vision_analyzer_node(state)
    return updated.model_dump()


def _planner_wrapper(state: GraphState) -> dict[str, Any]:
    updated = design_planner_node(state)
    return updated.model_dump()


def _market_wrapper(state: GraphState) -> dict[str, Any]:
    updated = market_sourcing_node(state)
    return updated.model_dump()


def _renderer_wrapper(state: GraphState) -> dict[str, Any]:
    updated = iterative_renderer_node(state)
    return updated.model_dump()


# ---------------------------------------------------------------------------
# Conditional edges — bail out on failure
# ---------------------------------------------------------------------------

def _after_vision(state: GraphState) -> Literal["plan", "end"]:
    if state.status == JobStatus.FAILED:
        logger.warning("Graph short-circuit — Vision Analyzer failed (job=%s)", state.job_id)
        return "end"
    return "plan"


def _after_planner(state: GraphState) -> Literal["source", "end"]:
    if state.status == JobStatus.FAILED:
        logger.warning("Graph short-circuit — Design Planner failed (job=%s)", state.job_id)
        return "end"
    return "source"


# ---------------------------------------------------------------------------
# Build and compile the graph
# ---------------------------------------------------------------------------

def build_graph():
    """
    Graph topology:
        [START] → vision → <ok?> → planner → <ok?> → market → renderer → [END]
                            ↓                  ↓
                          [END]              [END]
    """
    graph = StateGraph(GraphState)

    graph.add_node("vision_analyzer", _vision_wrapper)
    graph.add_node("design_planner", _planner_wrapper)
    graph.add_node("market_sourcing", _market_wrapper)
    graph.add_node("iterative_renderer", _renderer_wrapper)

    graph.add_edge(START, "vision_analyzer")

    graph.add_conditional_edges(
        "vision_analyzer",
        _after_vision,
        {"plan": "design_planner", "end": END},
    )

    graph.add_conditional_edges(
        "design_planner",
        _after_planner,
        {"source": "market_sourcing", "end": END},
    )

    graph.add_edge("market_sourcing", "iterative_renderer")
    graph.add_edge("iterative_renderer", END)

    return graph.compile()


# Singleton
_compiled_graph = None


def get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
        logger.info("LangGraph pipeline compiled: Vision → Planner → Market → Renderer")
    return _compiled_graph


# ---------------------------------------------------------------------------
# High-level runner
# ---------------------------------------------------------------------------

async def run_design_pipeline(initial_state: GraphState) -> GraphState:
    graph = get_graph()
    result_dict: dict[str, Any] = await graph.ainvoke(
        initial_state.model_dump(mode="json")
    )
    return GraphState.model_validate(result_dict)
