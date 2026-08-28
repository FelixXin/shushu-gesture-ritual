from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.hexagrams import HexagramResult, resolve_hexagram


class ResolveHexagramRequest(BaseModel):
    lines: list[int] = Field(min_length=6, max_length=6)


app = FastAPI(title="Shushu Gesture Ritual", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "shushu-gesture-ritual"}


@app.post("/api/v1/hexagrams/resolve")
def resolve_hexagram_endpoint(payload: ResolveHexagramRequest) -> HexagramResult:
    try:
        return resolve_hexagram(payload.lines)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


default_static_dir = Path(__file__).resolve().parents[2] / "frontend" / "dist"
static_dir = Path(os.environ.get("SHUSHU_STATIC_DIR", default_static_dir))
if not static_dir.is_dir():
    raise RuntimeError(f"Static frontend directory is missing: {static_dir}")

app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
