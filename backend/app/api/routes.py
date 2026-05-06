"""
FastAPI route definitions.

POST /api/upload          — upload image, run Vision Analyzer (Agent 1), return analysis
POST /api/generate-design — take analysis + style prefs, run Designer (Agent 2), return render
GET  /api/job/{job_id}    — poll job status
GET  /api/products        — search products with filters
GET  /api/products/stats  — get product catalog statistics
"""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse

from app.models.schemas import (
    AnalysisResponse,
    DesignRequest,
    DesignResponse,
    DesignStyle,
    ErrorResponse,
    GraphState,
    JobStatus,
    ProductSearchRequest,
    ProductSearchResponse,
)
from app.services.graph import run_design_pipeline
from app.services.storage import job_store
from app.utils.image import validate_and_encode_image

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def _run_pipeline_background(state: GraphState) -> None:
    """Runs the full pipeline and persists result."""
    try:
        final_state = await run_design_pipeline(state)
        await job_store.save(final_state)
    except Exception as exc:
        logger.exception("Pipeline crashed for job %s", state.job_id)
        state.status = JobStatus.FAILED
        state.error = str(exc)
        await job_store.save(state)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post(
    "/upload",
    response_model=AnalysisResponse,
    summary="Upload room photo → run Vision Analyzer",
    responses={400: {"model": ErrorResponse}, 413: {"model": ErrorResponse}, 415: {"model": ErrorResponse}},
)
async def upload_room(
    file: UploadFile = File(..., description="JPEG/PNG/WebP room photo"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Accepts a room photo, immediately kicks off Agent 1 (Vision Analyzer)
    synchronously (results returned in-response), then persists the state
    so the client can pass job_id to /generate-design.
    """
    image_b64 = await validate_and_encode_image(file)

    state = GraphState(image_base64=image_b64)
    await job_store.save(state)  # persist pending state

    # Run Agent 1 synchronously so the client gets the furniture list instantly
    from app.agents.vision_analyzer import vision_analyzer_node
    state = vision_analyzer_node(state)
    await job_store.save(state)

    if state.status == JobStatus.FAILED:
        raise HTTPException(status_code=500, detail=state.error)

    return AnalysisResponse(
        job_id=state.job_id,
        room_analysis=state.room_analysis,
        status=state.status,
    )


@router.post(
    "/generate-design",
    response_model=DesignResponse,
    summary="Generate redesign render (Agent 2)",
    responses={404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def generate_design(request: DesignRequest, job_id: UUID):
    """
    Takes the job_id from /upload plus user style preferences.
    Runs Agent 2 (Interior Designer + DALL-E 3) synchronously.
    For production, move Agent 2 to a background task and use polling.
    """
    state = await job_store.get(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")

    # Apply user selections
    state.desired_style = request.desired_style
    state.furniture_to_keep = request.furniture_to_keep
    state.user_notes = request.user_notes

    # Run Agent 2
    from app.agents.interior_designer import interior_designer_node
    state = interior_designer_node(state)
    await job_store.save(state)

    if state.status == JobStatus.FAILED:
        raise HTTPException(status_code=500, detail=state.error)

    return DesignResponse(
        job_id=state.job_id,
        room_analysis=state.room_analysis,
        design_proposal=state.design_proposal,
        status=state.status,
    )


@router.post(
    "/design/full",
    response_model=DesignResponse,
    summary="One-shot: upload + full pipeline in background",
)
async def full_pipeline(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    desired_style: DesignStyle = Form(DesignStyle.MODERN),
    furniture_to_keep: str = Form(""),   # comma-separated
    user_notes: str = Form(""),
):
    """
    Convenience endpoint: accepts file + form data, runs the entire pipeline
    in the background. Poll /api/job/{job_id} for status/results.
    """
    image_b64 = await validate_and_encode_image(file)

    keep_list = [x.strip() for x in furniture_to_keep.split(",") if x.strip()]
    state = GraphState(
        image_base64=image_b64,
        desired_style=desired_style,
        furniture_to_keep=keep_list,
        user_notes=user_notes,
    )
    await job_store.save(state)
    background_tasks.add_task(_run_pipeline_background, state)

    return JSONResponse(
        status_code=202,
        content={"job_id": str(state.job_id), "status": JobStatus.PENDING},
    )


@router.get(
    "/job/{job_id}",
    response_model=DesignResponse,
    summary="Poll job status / fetch results",
    responses={404: {"model": ErrorResponse}},
)
async def get_job(job_id: UUID):
    state = await job_store.get(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")

    return DesignResponse(
        job_id=state.job_id,
        room_analysis=state.room_analysis,
        design_proposal=state.design_proposal,
        status=state.status,
    )


# ---------------------------------------------------------------------------
# Market Agent Routes — Product Search & Recommendations
# ---------------------------------------------------------------------------

@router.get(
    "/products",
    response_model=ProductSearchResponse,
    summary="Search products with filters",
    tags=["Market Agent"],
)
async def search_products(
    category: str | None = Query(None, description="Product category (sofa, bed, table, etc.)"),
    style: str | None = Query(None, description="Design style (Modern, Minimalist, etc.)"),
    max_price: float | None = Query(None, description="Maximum price in RON"),
    search_term: str | None = Query(None, description="Search term (name, description)"),
):
    """
    Search products by category, style, price, and keywords.
    
    Example: GET /api/products?category=sofa&style=Modern&max_price=2500
    """
    from app.agents.market_agent import get_product_service
    
    service = get_product_service()
    request = ProductSearchRequest(
        category=category,
        style=style,
        max_price=max_price,
        search_term=search_term,
    )
    
    return service.search(request)


@router.get(
    "/products/by-category/{category}",
    response_model=list,
    summary="Get all products in a category",
    tags=["Market Agent"],
)
async def get_products_by_category(category: str):
    """Get all products in a specific category."""
    from app.agents.market_agent import get_product_service
    
    service = get_product_service()
    products = service.search_by_category(category)
    
    return [p.model_dump() for p in products]


@router.get(
    "/products/by-style/{style}",
    response_model=list,
    summary="Get all products with a specific style",
    tags=["Market Agent"],
)
async def get_products_by_style(style: str):
    """Get all products matching a design style."""
    from app.agents.market_agent import get_product_service
    
    service = get_product_service()
    products = service.search_by_style(style)
    
    return [p.model_dump() for p in products]


@router.get(
    "/products/{product_id}",
    summary="Get a single product by ID",
    tags=["Market Agent"],
)
async def get_product(product_id: str):
    """Get detailed information about a specific product."""
    from app.agents.market_agent import get_product_service
    
    service = get_product_service()
    product = service.get_product(product_id)
    
    if not product:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found.")
    
    return product.model_dump()


@router.get(
    "/products/stats/catalog",
    summary="Get product catalog statistics",
    tags=["Market Agent"],
)
async def get_products_stats():
    """Get statistics about the product catalog (total, categories, styles, price range)."""
    from app.agents.market_agent import get_product_service
    
    service = get_product_service()
    return service.get_stats()
