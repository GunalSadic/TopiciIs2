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
    MatchedProduct,
    ProductSearchRequest,
    ProductSearchResponse,
    SmartReplaceRequest,
    SourcingResponse,
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
    "/source-products",
    response_model=SourcingResponse,
    summary="Plan + Source: Design Planner → Market Agent (web search). Returns sourced products for preview.",
    responses={404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def source_products(request: DesignRequest, job_id: UUID):
    """
    Step 2A — Takes the job_id from /upload plus user style preferences.
    Runs: Design Planner → Market Agent (web search sourcing).
    Returns the sourced products (with images, prices, links) for user confirmation
    BEFORE rendering. User can review and then call /render-design.
    """
    state = await job_store.get(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")

    # Apply user selections
    state.desired_style = request.desired_style
    state.furniture_to_keep = request.furniture_to_keep
    state.user_notes = request.user_notes
    state.max_budget = request.max_budget

    # Step 1: Design Planner — create redesign plan
    from app.agents.design_planner import design_planner_node
    state = design_planner_node(state)

    if state.status == JobStatus.FAILED:
        await job_store.save(state)
        raise HTTPException(status_code=500, detail=state.error)

    # Step 2: Market Agent — source real products via web search
    from app.agents.market_agent import market_sourcing_node
    state = market_sourcing_node(state)
    await job_store.save(state)

    return SourcingResponse(
        job_id=state.job_id,
        room_analysis=state.room_analysis,
        design_plan=state.design_plan,
        sourced_products=state.sourced_products,
        status=state.status,
    )


@router.post(
    "/render-design",
    response_model=DesignResponse,
    summary="Render: Iterative Renderer (gpt-image-1). Call after /source-products.",
    responses={404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def render_design(job_id: UUID):
    """
    Step 2B — Takes the job_id from /source-products (after user confirmed the products).
    Runs the Iterative Renderer only — edits original image one product at a time.
    """
    state = await job_store.get(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")

    if not state.sourced_products:
        raise HTTPException(status_code=400, detail="No sourced products. Call /source-products first.")

    # Run Iterative Renderer — edit original image one product at a time
    from app.agents.iterative_renderer import iterative_renderer_node
    state = iterative_renderer_node(state)
    await job_store.save(state)

    if state.status == JobStatus.FAILED:
        raise HTTPException(status_code=500, detail=state.error)

    return DesignResponse(
        job_id=state.job_id,
        room_analysis=state.room_analysis,
        design_proposal=state.design_proposal,
        sourced_products=state.sourced_products,
        alternative_products=state.alternative_products,
        status=state.status,
    )


@router.post(
    "/generate-design",
    response_model=DesignResponse,
    summary="(Legacy) Full pipeline: Planner → Market → Renderer in one call",
    responses={404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def generate_design(request: DesignRequest, job_id: UUID):
    """
    Legacy endpoint — runs the full pipeline in one call (no preview step).
    Prefer /source-products + /render-design for the two-step flow.
    """
    state = await job_store.get(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")

    state.desired_style = request.desired_style
    state.furniture_to_keep = request.furniture_to_keep
    state.user_notes = request.user_notes
    state.max_budget = request.max_budget

    from app.agents.design_planner import design_planner_node
    state = design_planner_node(state)
    if state.status == JobStatus.FAILED:
        await job_store.save(state)
        raise HTTPException(status_code=500, detail=state.error)

    from app.agents.market_agent import market_sourcing_node
    state = market_sourcing_node(state)

    from app.agents.iterative_renderer import iterative_renderer_node
    state = iterative_renderer_node(state)
    await job_store.save(state)

    if state.status == JobStatus.FAILED:
        raise HTTPException(status_code=500, detail=state.error)

    return DesignResponse(
        job_id=state.job_id,
        room_analysis=state.room_analysis,
        design_proposal=state.design_proposal,
        sourced_products=state.sourced_products,
        alternative_products=state.alternative_products,
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
        sourced_products=state.sourced_products,
        alternative_products=state.alternative_products,
        status=state.status,
    )


# ---------------------------------------------------------------------------
# Smart Replace — swap a single product and re-render
# ---------------------------------------------------------------------------

@router.post(
    "/smart-replace",
    response_model=DesignResponse,
    summary="Smart Replace: swap one product and re-render",
    responses={404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    tags=["Smart Replace"],
)
async def smart_replace(request: SmartReplaceRequest, job_id: UUID):
    """
    Swap a single product in the current design and re-render.
    The user selects a new product for a specific slot (e.g. replace the sofa).
    Only the target slot is conceptually replaced; the rest of the design stays.

    This is the core "Interactive Inpainting" feature — currently uses DALL-E 3
    full re-render with updated product context. Future: SAM2 + Stable Diffusion
    inpainting for targeted pixel-level replacement.
    """
    state = await job_store.get(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")

    # Find the new product
    from app.agents.market_agent import get_product_service
    service = get_product_service()
    new_product = service.get_product(request.new_product_id)
    if not new_product:
        raise HTTPException(status_code=404, detail=f"Product {request.new_product_id} not found.")

    # Create the replacement MatchedProduct
    replacement = MatchedProduct(
        product_id=new_product.id,
        name=new_product.name,
        category=str(new_product.category),
        price=new_product.price,
        currency=new_product.currency,
        image_url=new_product.image_url,
        product_url=new_product.product_url,
        store=new_product.store,
        slot=request.slot,
    )

    # Swap in the sourced products list
    updated_products = [
        replacement if p.slot == request.slot else p
        for p in state.sourced_products
    ]
    # If slot didn't exist, add it
    if not any(p.slot == request.slot for p in state.sourced_products):
        updated_products.append(replacement)

    state.sourced_products = updated_products

    # Re-render with updated product list
    from app.agents.iterative_renderer import iterative_renderer_node
    state = iterative_renderer_node(state)
    await job_store.save(state)

    if state.status == JobStatus.FAILED:
        raise HTTPException(status_code=500, detail=state.error)

    return DesignResponse(
        job_id=state.job_id,
        room_analysis=state.room_analysis,
        design_proposal=state.design_proposal,
        sourced_products=state.sourced_products,
        alternative_products=state.alternative_products,
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
