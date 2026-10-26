import io

from fastapi.testclient import TestClient
from PIL import Image

from app import main


client = TestClient(main.app)


def test_health_and_ready():
    assert client.get("/health").json()["status"] == "ok"
    assert "gemini_configured" in client.get("/ready").json()


def test_image_rejects_wrong_mime_type():
    response = client.post(
        "/api/analyze-image",
        files={"file": ("clip.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 415


def test_image_rejects_invalid_image_bytes():
    response = client.post(
        "/api/analyze-image",
        files={"file": ("eye.png", b"not really an image", "image/png")},
    )
    assert response.status_code == 400


def test_image_calls_gemini(monkeypatch):
    output = io.BytesIO()
    Image.new("RGB", (16, 16), "white").save(output, format="PNG")

    monkeypatch.setattr(
        main,
        "generate_gemini_text",
        lambda prompt, data, mime_type: "Visible observations; not a diagnosis.",
    )

    response = client.post(
        "/api/analyze-image",
        files={"file": ("eye.png", output.getvalue(), "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["is_diagnosis"] is False
    assert "observations" in body["result"]


def test_video_rejects_wrong_mime_type():
    response = client.post(
        "/api/analyze-closure",
        files={"file": ("eye.jpg", b"not a video", "image/jpeg")},
    )
    assert response.status_code == 415


def test_video_calls_gemini(monkeypatch):
    monkeypatch.setattr(
        main,
        "generate_gemini_text",
        lambda prompt, data, mime_type: "Video observations; not a diagnosis.",
    )

    response = client.post(
        "/api/analyze-closure",
        files={"file": ("clip.webm", b"sample video bytes", "video/webm")},
    )

    assert response.status_code == 200
    assert response.json()["assessment"] == "video_eye_closure"
    assert response.json()["is_diagnosis"] is False


def test_report_returns_pdf():
    response = client.post(
        "/api/generate-report",
        json={
            "assessments": {
                "manual_blink_rate": {"count": 8, "bpm": 24},
                "osdi": "Not yet assessed",
            }
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert response.content.startswith(b"%PDF")


def test_report_rejects_empty_assessments():
    response = client.post(
        "/api/generate-report",
        json={"assessments": {}},
    )
    assert response.status_code == 422
