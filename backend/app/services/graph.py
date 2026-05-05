"""
LangGraph orchestration — wires Agent 1 → Agent 2 with conditional edge
for error short-circuiting.

LangGraph 1.0 API notes
------------------------
* START must be imported explicitly from langgraph.graph.
* set_entry_point() is removed — use add_edge(START, node_name) instead.
* StateGraph accepts a Pydantic BaseModel as the state schema.
* ainvoke() returns a plain dict whose keys mirror GraphState fields;
  we reconstruct the Pydantic model from it.
* Nodes must return a *dict of updates* (not the full model) so LangGraph
  can merge them into the running state via model_validate / __or__.
"""
from __future__ import annotations

import logging
from typing import Any, Literal

from langgraph.graph import END, START, StateGraph

from app.agents.vision_analyzer import vision_analyzer_node
from app.agents.interior_designer import interior_designer_node
from app.models.schemas import GraphState, JobStatus

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node wrappers — LangGraph 1.0 nodes must return dict[str, Any] updates
# ---------------------------------------------------------------------------

def _vision_analyzer_wrapper(state: GraphState) -> dict[str, Any]:
    """Run Agent 1 and return only the fields that changed."""
    updated = vision_analyzer_node(state)
    return updated.model_dump()


def _interior_designer_wrapper(state: GraphState) -> dict[str, Any]:
    """Run Agent 2 and return only the fields that changed."""
    updated = interior_designer_node(state)
    return updated.model_dump()


# ---------------------------------------------------------------------------
# Conditional edge — bail out early if Agent 1 failed
# ---------------------------------------------------------------------------

def should_continue(state: GraphState) -> Literal["design", "end"]:
    if state.status == JobStatus.FAILED:
        logger.warning("Graph short-circuit — Agent 1 failed (job=%s)", state.job_id)
        return "end"
    return "design"


# ---------------------------------------------------------------------------
# Build and compile the graph (called once at startup)
# ---------------------------------------------------------------------------

def build_graph():
    """
    Graph topology:
        [START] → vision_analyzer → <conditional> → interior_designer → [END]
                                          ↓ (on failure)
                                        [END]
    """
    graph = StateGraph(GraphState)

    graph.add_node("vision_analyzer", _vision_analyzer_wrapper)
    graph.add_node("interior_designer", _interior_designer_wrapper)

    # LangGraph 1.0: use add_edge(START, ...) — set_entry_point() is gone
    graph.add_edge(START, "vision_analyzer")

    graph.add_conditional_edges(
        "vision_analyzer",
        should_continue,
        {
            "design": "interior_designer",
            "end": END,
        },
    )
    graph.add_edge("interior_designer", END)

    return graph.compile()


# Singleton — compile once on first use, reuse across requests
_compiled_graph = None


def get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
        logger.info("LangGraph 1.0 graph compiled and ready")
    return _compiled_graph


# ---------------------------------------------------------------------------
# High-level runner
# ---------------------------------------------------------------------------

async def run_design_pipeline(initial_state: GraphState) -> GraphState:
    """
    Invoke the compiled graph asynchronously.
    ainvoke() returns a plain dict — reconstruct the typed model.
    """
    graph = get_graph()
    # Pass as dict so LangGraph can validate via GraphState.__init__
    result_dict: dict[str, Any] = await graph.ainvoke(
        initial_state.model_dump(mode="json")
    )
    return GraphState.model_validate(result_dict)
