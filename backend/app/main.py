"""
FastAPI application entry-point.
"""
from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

# Load .env BEFORE any other import that reads env vars (OpenAI client, etc.)
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title="RoomRevive AI",
        version="0.1.0",
        description="AI-powered interior design MVP — LangGraph + GPT-4o + DALL-E 3",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ------------------------------------------------------------------ #
    # CORS — tighten origins for production                               #
    # ------------------------------------------------------------------ #
    origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)

    @app.on_event("startup")
    async def startup_event():
        """Initialize services on startup."""
        logger.info("Initializing ProductService...")
        from app.agents.market_agent import initialize_product_service
        initialize_product_service()
        logger.info("ProductService initialized")

    @app.get("/health", tags=["ops"])
    async def health():
        return {"status": "ok", "service": "roomrevive-ai"}

    logger.info("RoomRevive AI backend ready")
    return app


app = create_app()
