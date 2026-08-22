from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.hexagrams import resolve_hexagram
from app.main import app


client = TestClient(app)


def test_six_old_yang_lines_resolve_qian_changing_to_kun() -> None:
    result = resolve_hexagram([9, 9, 9, 9, 9, 9])

    assert result == {
        "lines": [9, 9, 9, 9, 9, 9],
        "moving_lines": [1, 2, 3, 4, 5, 6],
        "primary": {"number": 1, "name": "乾", "upper": "乾", "lower": "乾"},
        "changed": {"number": 2, "name": "坤", "upper": "坤", "lower": "坤"},
    }


def test_alternating_yang_yin_lines_resolve_jiji() -> None:
    result = resolve_hexagram([7, 8, 7, 8, 7, 8])

    assert result["moving_lines"] == []
    assert result["primary"] == {"number": 63, "name": "既济", "upper": "坎", "lower": "离"}
    assert result["changed"] == result["primary"]


@pytest.mark.parametrize("lines", [[7, 8], [7, 8, 7, 8, 7, 5]])
def test_invalid_line_sets_are_rejected(lines: list[int]) -> None:
    with pytest.raises(ValueError, match="six lines|6, 7, 8, or 9"):
        resolve_hexagram(lines)


def test_health_reports_service_ready() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "shushu-gesture-ritual"}


def test_api_resolves_six_lines() -> None:
    response = client.post("/api/v1/hexagrams/resolve", json={"lines": [7, 8, 7, 8, 7, 8]})

    assert response.status_code == 200
    assert response.json()["primary"] == {
        "number": 63,
        "name": "既济",
        "upper": "坎",
        "lower": "离",
    }


def test_api_rejects_invalid_line_values() -> None:
    response = client.post("/api/v1/hexagrams/resolve", json={"lines": [7, 8, 7, 8, 7, 5]})

    assert response.status_code == 422
    assert response.json()["detail"] == "line values must be 6, 7, 8, or 9"
