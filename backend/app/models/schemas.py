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
    GAMING_ROOM = "Gaming Room"


class JobStatus(str, Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    DESIGNING = "designing"
    COMPLETED = "completed"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# LangGraph state (passed between agents)
# ---------------------------------------------------------------------------

class DetectedFurniture(BaseModel):
    name: str
    keep: bool = True
    condition: str = "good"            # good | fair | poor
    estimated_position: str = ""       # e.g. "center-left"


class RoomAnalysis(BaseModel):
    room_type: str = ""                # bedroom, living room, office …
    detected_furniture: list[DetectedFurniture] = Field(default_factory=list)
    spatial_notes: str = ""            # windows, doors, room dimensions estimate
    lighting: str = ""                 # natural / artificial / dark
    raw_description: str = ""          # full GPT-4o prose description


class DesignProposal(BaseModel):
    image_prompt: str = ""             # final DALL-E 3 prompt
    design_rationale: str = ""         # human-readable explanation
    generated_image_url: str = ""      # DALL-E output URL
    revised_prompt: str = ""           # DALL-E may revise the prompt


# ---------------------------------------------------------------------------
# LangGraph graph state
# ---------------------------------------------------------------------------

class GraphState(BaseModel):
    job_id: UUID = Field(default_factory=uuid4)
    image_base64: str = ""             # base64-encoded upload
    image_url: str = ""                # or a URL (one of the two is used)
    desired_style: DesignStyle = DesignStyle.MODERN
    furniture_to_keep: list[str] = Field(default_factory=list)
    user_notes: str = ""
    # agent outputs
    room_analysis: RoomAnalysis = Field(default_factory=RoomAnalysis)
    design_proposal: DesignProposal = Field(default_factory=DesignProposal)
    # execution metadata
    status: JobStatus = JobStatus.PENDING
    error: str = ""


# ---------------------------------------------------------------------------
# API request / response DTOs
# ---------------------------------------------------------------------------

class DesignRequest(BaseModel):
    desired_style: DesignStyle
    furniture_to_keep: list[str] = Field(default_factory=list)
    user_notes: str = ""


class AnalysisResponse(BaseModel):
    job_id: UUID
    room_analysis: RoomAnalysis
    status: JobStatus


class DesignResponse(BaseModel):
    job_id: UUID
    room_analysis: RoomAnalysis
    design_proposal: DesignProposal
    status: JobStatus


class ErrorResponse(BaseModel):
    detail: str
    job_id: UUID | None = None


# ---------------------------------------------------------------------------
# Future-proof DB model stubs (wire these to SQLAlchemy / Prisma later)
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
    designs_limit: int = 3            # free tier


class JobRecord(BaseModel):
    """Mirrors a DB row — persist GraphState here after completion."""
    id: UUID
    user_id: UUID | None = None
    status: JobStatus
    desired_style: DesignStyle
    generated_image_url: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
