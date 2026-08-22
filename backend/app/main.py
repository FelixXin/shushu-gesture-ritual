from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.hexagrams import HexagramResult, resolve_hexagram


class ResolveHexagramRequest(BaseModel):
    lines: list[int] = Field(min_length=6, max_length=6)


app = FastAPI(title="Shushu Gesture Ritual API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "shushu-gesture-ritual"}


@app.post("/api/v1/hexagrams/resolve")
def resolve_hexagram_endpoint(payload: ResolveHexagramRequest) -> HexagramResult:
    try:
        return resolve_hexagram(payload.lines)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
