"""
Pydantic schemas shared across the application.
All AI state, request/response DTOs, and DB-ready models live here.
"""
from __future__ import annotations

from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class DesignStyle(str, Enum):
    MODERN = "Modern"
    MINIMALIST = "Minimalist"
    LUXURY = "Luxury"
    SCANDINAVIAN = "Scandinavian"
    JAPANDI = "Japandi"
    INDUSTRIAL = "Industrial"
    BOHEMIAN = "Bohemian"
    ART_DECO = "Art Deco"
    COASTAL = "Coastal"
    TRADITIONAL = "Traditional"
    GAMING_ROOM = "Gaming Room"


class JobStatus(str, Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    PLANNING = "planning"
    SOURCING = "sourcing"
    RENDERING = "rendering"
    COMPLETED = "completed"
    FAILED = "failed"


class ProductCategory(str, Enum):
    SOFA = "sofa"
    BED = "bed"
    TABLE = "table"
    CHAIR = "chair"
    CABINET = "cabinet"
    WARDROBE = "wardrobe"
    DESK = "desk"
    SHELF = "shelf"
    LAMP = "lamp"
    DECOR = "decor"


# ---------------------------------------------------------------------------
# Market Agent - Product Models
# ---------------------------------------------------------------------------

class ProductDimensions(BaseModel):
    width: str = ""
    depth: str = ""
    height: str = ""
    length: str = ""


class Product(BaseModel):
    id: str
    name: str
    category: ProductCategory | str
    subcategory: str = ""
    price: float
    currency: str = "RON"
    description: str = ""
    styles: list[str] = Field(default_factory=list)
    materials: list[str] = Field(default_factory=list)
    colors: list[str] = Field(default_factory=list)
    dimensions: ProductDimensions = Field(default_factory=ProductDimensions)
    image_url: str
    store: str
    product_url: str
    in_stock: bool = True
    rating: float = 0.0
    reviews: int = 0


class ProductSearchRequest(BaseModel):
    category: str | None = None
    style: str | None = None
    max_price: float | None = None
    search_term: str | None = None


class ProductSearchResponse(BaseModel):
    products: list[Product]
    total: int
    query: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Design Planner output — detailed suggestions
# ---------------------------------------------------------------------------

class DesignSuggestion(BaseModel):
    """One specific design suggestion with detailed placement, color, and vibe."""
    id: str = Field(default_factory=lambda: str(__import__('uuid').uuid4()))
    item_type: str = ""                # e.g. "puff", "lamp", "rug", "plant"
    description: str = ""              # full detailed description for market search
    placement: str = ""                # e.g. "between desk and window", "right corner"
    colors: list[str] = Field(default_factory=list)  # e.g. ["white", "cream"]
    style_vibe: str = ""               # e.g. "cozy", "minimalist", "modern"
    specific_details: str = ""         # e.g. "umbrella-like shape", "soft fabric", etc
    is_replacement: bool = False       # True if replacing existing furniture, False if adding
    target_furniture: str = ""         # which furniture it's replacing (if replacement)
    search_keywords: list[str] = Field(default_factory=list)  # Romanian keywords


class DesignPlan(BaseModel):
    """The planner's full output — structured list of suggestions."""
    suggestions: list[DesignSuggestion] = Field(default_factory=list)  # detailed suggestions
    overall_vision: str = ""           # design rationale


# Old PlannedItem kept for compatibility, but we'll use suggestions now
class PlannedItem(BaseModel):
    """One furniture piece the planner wants to replace (deprecated, use DesignSuggestion)."""
    slot: str                          # e.g. "sofa", "coffee table"
    current_description: str = ""      # what's there now
    desired_description: str = ""      # what to replace it with (detailed)
    search_keywords: list[str] = Field(default_factory=list)  # Romanian keywords for store search
    position_in_room: str = ""         # where in the room


# ---------------------------------------------------------------------------
# Matched product from Romanian stores
# ---------------------------------------------------------------------------

class MatchedProduct(BaseModel):
    """A real product matched to a furniture slot in the room."""
    product_id: str
    name: str
    category: str
    price: float
    currency: str = "RON"
    image_url: str = ""
    image_base64: str = ""             # downloaded product image for renderer
    product_url: str = ""
    store: str = ""
    slot: str = ""                     # which PlannedItem slot this fills
    description: str = ""


# ---------------------------------------------------------------------------
# Room analysis (Agent 1 output)
# ---------------------------------------------------------------------------

class DetectedFurniture(BaseModel):
    name: str
    keep: bool = True
    condition: str = "good"
    estimated_position: str = ""


class RoomAnalysis(BaseModel):
    room_type: str = ""
    detected_furniture: list[DetectedFurniture] = Field(default_factory=list)
    spatial_notes: str = ""
    lighting: str = ""
    raw_description: str = ""


# ---------------------------------------------------------------------------
# Design Proposal (final output)
# ---------------------------------------------------------------------------

class DesignProposal(BaseModel):
    design_rationale: str = ""
    generated_image_url: str = ""      # final rendered image URL
    generated_image_b64: str = ""      # final rendered image base64
    render_steps: list[str] = Field(default_factory=list)  # description of each step
    intermediate_images: list[str] = Field(default_factory=list)  # base64 of each iteration
    intermediate_products: list[str] = Field(default_factory=list)  # product name for each iteration
    matched_products: list[MatchedProduct] = Field(default_factory=list)
    suggestions: list[MatchedProduct] = Field(default_factory=list)
    total_price: float = 0.0
    decor_description: str = ""        # AI-generated decor that was added


# ---------------------------------------------------------------------------
# LangGraph graph state
# ---------------------------------------------------------------------------

class GraphState(BaseModel):
    job_id: UUID = Field(default_factory=uuid4)
    image_base64: str = ""             # base64-encoded original room photo
    image_url: str = ""
    desired_style: DesignStyle = DesignStyle.MODERN
    furniture_to_keep: list[str] = Field(default_factory=list)
    user_notes: str = ""
    max_budget: float | None = None

    # Agent 1 output
    room_analysis: RoomAnalysis = Field(default_factory=RoomAnalysis)

    # Design Planner output
    design_plan: DesignPlan = Field(default_factory=DesignPlan)

    # Market Agent output
    sourced_products: list[MatchedProduct] = Field(default_factory=list)
    alternative_products: list[MatchedProduct] = Field(default_factory=list)

    # Renderer output
    current_render_b64: str = ""       # latest rendered image (base64)
    design_proposal: DesignProposal = Field(default_factory=DesignProposal)

    # Execution metadata
    status: JobStatus = JobStatus.PENDING
    error: str = ""


# ---------------------------------------------------------------------------
# API request / response DTOs
# ---------------------------------------------------------------------------

class DesignRequest(BaseModel):
    desired_style: DesignStyle
    furniture_to_keep: list[str] = Field(default_factory=list)
    user_notes: str = ""
    max_budget: float | None = None


class SmartReplaceRequest(BaseModel):
    """Request to swap a single product in the current design."""
    slot: str
    new_product_id: str


class CustomProductRequest(BaseModel):
    """User-provided product to add to the sourced products list."""
    name: str = "Produs Custom"
    url: str
    slot: str
    price: float = 0.0
    currency: str = "RON"
    store: str = "Custom"
    image_url: str = ""


class AnalysisResponse(BaseModel):
    job_id: UUID
    room_analysis: RoomAnalysis
    status: JobStatus


class DesignResponse(BaseModel):
    job_id: UUID
    room_analysis: RoomAnalysis
    design_proposal: DesignProposal
    sourced_products: list[MatchedProduct] = Field(default_factory=list)
    alternative_products: list[MatchedProduct] = Field(default_factory=list)
    status: JobStatus


class SourcingResponse(BaseModel):
    """Returned after Plan + Market sourcing, before rendering.
    Shows user the sourced products for preview/confirmation."""
    job_id: UUID
    room_analysis: RoomAnalysis
    design_plan: DesignPlan
    sourced_products: list[MatchedProduct] = Field(default_factory=list)
    status: JobStatus


class ErrorResponse(BaseModel):
    detail: str
    job_id: UUID | None = None


# ---------------------------------------------------------------------------
# Future-proof stubs
# ---------------------------------------------------------------------------

class UserTier(str, Enum):
    FREE = "free"
    PREMIUM = "premium"
    B2B_BASIC = "b2b_basic"
    B2B_PRO = "b2b_pro"


class UserStub(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    email: str = ""
    tier: UserTier = UserTier.FREE
    designs_used_this_month: int = 0
    designs_limit: int = 3


class JobRecord(BaseModel):
    id: UUID
    user_id: UUID | None = None
    status: JobStatus
    desired_style: DesignStyle
    generated_image_url: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
