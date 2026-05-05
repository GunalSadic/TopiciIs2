"""
Ephemeral in-memory job store for the MVP.
Swap with Redis or a DB-backed store in production.
"""
from __future__ import annotations

import asyncio
from uuid import UUID

from app.models.schemas import GraphState


class JobStore:
    def __init__(self) -> None:
        self._store: dict[UUID, GraphState] = {}
        self._lock = asyncio.Lock()

    async def save(self, state: GraphState) -> None:
        async with self._lock:
            self._store[state.job_id] = state

    async def get(self, job_id: UUID) -> GraphState | None:
        async with self._lock:
            return self._store.get(job_id)

    async def delete(self, job_id: UUID) -> None:
        async with self._lock:
            self._store.pop(job_id, None)


# Module-level singleton
job_store = JobStore()
