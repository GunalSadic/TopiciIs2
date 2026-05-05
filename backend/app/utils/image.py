"""
Image utilities — validation and base64 encoding.
"""
from __future__ import annotations

import base64
from io import BytesIO

from fastapi import HTTPException, UploadFile
from PIL import Image

MAX_FILE_SIZE_MB = 10
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION = 4096


async def validate_and_encode_image(file: UploadFile) -> str:
    """
    Validates size, type, and dimensions.
    Returns a base64-encoded string (no data-URL prefix).
    Raises HTTPException on invalid input.
    """
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type '{file.content_type}'. Use JPEG, PNG, or WebP.",
        )

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Maximum is {MAX_FILE_SIZE_MB} MB.",
        )

    # Validate it's a real image and check dimensions
    try:
        img = Image.open(BytesIO(contents))
        w, h = img.size
        if w > MAX_DIMENSION or h > MAX_DIMENSION:
            # Downscale to avoid GPT-4o token explosion
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)
            buffer = BytesIO()
            fmt = img.format or "JPEG"
            img.save(buffer, format=fmt)
            contents = buffer.getvalue()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {exc}") from exc

    return base64.b64encode(contents).decode("utf-8")
