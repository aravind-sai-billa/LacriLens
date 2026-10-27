import io
import json
import logging
import re
from html import escape
from typing import Any, Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)
from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

logger = logging.getLogger("lacrilens.api")


class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = ""
    frontend_origins: str = "http://localhost:5173"
    max_upload_mb: int = 20
    request_timeout_seconds: int = 45

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False,
    )


settings = Settings()

app = FastAPI(
    title="LacriLens API",
    description="Backend for the LacriLens dry-eye screening prototype.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in settings.frontend_origins.split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
ALLOWED_VIDEO_TYPES = {
    "video/webm",
    "video/mp4",
    "video/quicktime",
}



EyeState = Literal["OPEN", "PARTIALLY_CLOSED", "CLOSED", "UNCERTAIN"]


class BlinkObservation(BaseModel):
    timestamp_seconds: float = Field(ge=0, le=60)
    state: EyeState


class BlinkAnalysis(BaseModel):
    clip_duration_seconds: float | None = Field(default=None, gt=0, le=60)
    blink_count: int | None = Field(default=None, ge=0)
    observations: list[BlinkObservation] = Field(default_factory=list)
    quality_notes: list[str] = Field(default_factory=list)
    analysis_text: str = ""


class ReportRequest(BaseModel):
    assessments: dict[str, Any] = Field(min_length=1)
    disclaimer: str = (
        "This report is a screening aid, not a medical diagnosis. "
        "AI-generated observations may be inaccurate. Consult a qualified "
        "eye-care professional for clinical evaluation."
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready():
    configured = bool(settings.gemini_api_key and settings.gemini_model)
    return {
        "status": "ready" if configured else "configuration_required",
        "gemini_configured": configured,
    }


def require_gemini_configuration() -> None:
    if not settings.gemini_api_key or not settings.gemini_model:
        raise HTTPException(
            status_code=503,
            detail="Gemini is not configured on the backend.",
        )


def generate_gemini_text(prompt: str, data: bytes, mime_type: str) -> str:
    """Call Gemini server-side; video requests use supported 24 FPS sampling."""
    require_gemini_configuration()

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(
                timeout=settings.request_timeout_seconds * 1000
            ),
        )

        if mime_type in ALLOWED_VIDEO_TYPES:
            # Gemini's video_metadata.fps is limited to 24. This controls
            # the requested video-frame sampling rate; it does not claim
            # that the source file itself was recorded at 24 FPS.
            video_part = types.Part(
                inline_data=types.Blob(data=data, mime_type=mime_type),
                video_metadata=types.VideoMetadata(fps=24),
            )
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=[types.Part(text=prompt), video_part],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0,
                ),
            )
        else:
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=[
                    prompt,
                    types.Part.from_bytes(data=data, mime_type=mime_type),
                ],
            )

        result_text = (response.text or "").strip()
        if not result_text:
            raise RuntimeError("Gemini returned an empty response.")
        return result_text

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Gemini request failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini analysis failed. Check backend logs and model "
                "configuration, then retry."
            ),
        ) from exc


async def read_upload_limited(upload: UploadFile) -> bytes:
    limit = max(1, settings.max_upload_mb) * 1024 * 1024
    data = await upload.read(limit + 1)

    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    if len(data) > limit:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.max_upload_mb} MB upload limit.",
        )

    return data


@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    """Analyze a still eye image with Gemini. This is not a diagnosis."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Upload a JPEG, PNG, or WebP image.",
        )

    data = await read_upload_limited(file)

    try:
        with Image.open(io.BytesIO(data)) as image:
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid supported image.",
        ) from exc

    prompt = """
You are assisting a prototype eye-comfort screening application.
Describe only visible, non-diagnostic observations from this image.
If the eye or relevant area is not clearly visible, say so.
Do not infer a diagnosis, disease, or severity from the image.
Mention image-quality limitations and recommend professional assessment
when the user has symptoms or concerns. Use concise plain language.
Clearly label your response as AI-assisted observations, not a diagnosis.
"""

    result = await run_in_threadpool(
        generate_gemini_text,
        prompt,
        data,
        file.content_type,
    )

    return {
        "status": "success",
        "assessment": "eye_image",
        "model": settings.gemini_model,
        "result": result,
        "is_diagnosis": False,
    }


@app.post("/api/analyze-closure")
async def analyze_closure(file: UploadFile = File(...)):
    """Analyze a short eye video and return cautious blink estimates."""
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Upload a WebM, MP4, or QuickTime video.",
        )

    data = await read_upload_limited(file)
    require_gemini_configuration()

    prompt = """
Analyze this short eye video for a non-diagnostic blink estimate.
Return JSON with these fields:
- clip_duration_seconds: number or null
- blink_count: non-negative integer or null
- observations: list of objects with timestamp_seconds and state
- quality_notes: list of strings
- analysis_text: string

Count only complete blinks (closure followed by reopening).
Never invent blinks, timestamps, or duration.
Use states OPEN, PARTIALLY_CLOSED, CLOSED, or UNCERTAIN.
If the count is unreliable, return null for blink_count and explain why.
This is an experimental estimate, not a validated clinical measurement.
"""

    try:
        raw = await run_in_threadpool(
            generate_gemini_text, prompt, data, file.content_type
        )
        raw = raw.strip()
        if not raw:
            raise ValueError("Gemini returned an empty response.")

        # Accept JSON, including responses wrapped in Markdown fences.
        cleaned = re.sub(
            r"^\s*```(?:json)?\s*", "", raw, flags=re.IGNORECASE
        )
        cleaned = re.sub(r"\s*```\s*$", "", cleaned)

        try:
            analysis = BlinkAnalysis.model_validate_json(cleaned)
        except Exception:
            # Preserve text-only compatibility, but do not fabricate metrics.
            return {
                "status": "success",
                "assessment": "video_eye_closure",
                "model": settings.gemini_model,
                "result": raw,
                "blink_count": None,
                "blink_rate_bpm": None,
                "blink_metrics_status": "text_estimate_requires_review",
                "clip_duration_seconds": None,
                "observations": [],
                "quality_notes": [
                    "Structured blink metrics were not returned; "
                    "review the video and analysis manually."
                ],
                "is_diagnosis": False,
            }

        count = analysis.blink_count
        duration = analysis.clip_duration_seconds

        # Never divide by zero or report a rate for an invalid duration.
        valid_duration = duration is not None and duration > 0
        bpm = (
            round(count / duration * 60, 1)
            if count is not None and valid_duration
            else None
        )

        result_text = analysis.analysis_text.strip() or (
            "Review the blink observations and quality notes. "
            "This is not a clinical measurement."
        )

        return {
            "status": "success",
            "assessment": "video_eye_closure",
            "model": settings.gemini_model,
            "result": result_text,
            "blink_count": count,
            "blink_rate_bpm": bpm,
            "blink_metrics_status": (
                "estimate_available"
                if count is not None and bpm is not None
                else "uncertain_or_unavailable"
            ),
            "clip_duration_seconds": duration,
            "observations": [
                item.model_dump() for item in analysis.observations
            ],
            "quality_notes": analysis.quality_notes,
            "is_diagnosis": False,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Gemini video analysis failed: %s", type(exc).__name__
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini video analysis failed. Check backend logs "
                "and model configuration, then retry."
            ),
        ) from exc


def _report_escape(value: Any) -> str:
    """Safely format arbitrary values for ReportLab Paragraphs."""
    if value is None:
        return "Not provided"
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (dict, list, tuple)):
        value = json.dumps(value, ensure_ascii=False, default=str, indent=2)
    return escape(str(value)).replace("\n", "<br/>")


def _find_report_value(data: Any, *keys: str) -> Any:
    """Find a key recursively, allowing snake_case and camelCase."""
    wanted = {str(k).lower().replace("_", "") for k in keys}
    if isinstance(data, dict):
        for key, value in data.items():
            if str(key).lower().replace("_", "") in wanted:
                return value
        for value in data.values():
            found = _find_report_value(value, *keys)
            if found is not None:
                return found
    elif isinstance(data, (list, tuple)):
        for value in data:
            found = _find_report_value(value, *keys)
            if found is not None:
                return found
    return None


def _osdi_category(score_value: Any) -> dict:
    """Apply the project's fixed OSDI severity bands."""
    try:
        score = float(score_value)
    except (TypeError, ValueError):
        return {"score": None, "category": "Unavailable", "range": "N/A"}

    if not 0 <= score <= 100:
        return {"score": None, "category": "Invalid score", "range": "N/A"}

    if score <= 12:
        category, score_range = "Normal / minimal symptoms", "0-12"
    elif score <= 22:
        category, score_range = "Mild symptoms", "13-22"
    elif score <= 32:
        category, score_range = "Moderate symptoms", "23-32"
    else:
        category, score_range = "Severe symptoms", "33-100"

    return {"score": score, "category": category, "range": score_range}


def generate_gemini_report_interpretation(assessments: dict) -> dict:
    """Use Gemini for patient-facing explanations; fall back if unavailable."""
    payload = json.dumps(assessments, ensure_ascii=False, default=str)
    if len(payload) > 45000:
        raise HTTPException(
            status_code=413,
            detail="Assessment results are too large to interpret in one report.",
        )

    prompt = f"""
You are LacriLens's patient-education assistant. LacriLens is a non-diagnostic
eye-comfort screening prototype. Interpret only the assessment data supplied.

SAFETY AND ACCURACY:
- Never diagnose dry eye disease or any other condition.
- Never invent symptoms, observations, values, history, or measurements.
- Explain the OSDI result and category supplied in the data; do not change them.
- The OSDI score bands are a project-defined questionnaire classification,
  not a diagnosis and not a measure of confirmed disease severity.
- Distinguish manual calculations from AI estimates.
- A short video blink-rate estimate is not a validated clinical measurement.
- A photo cannot confirm dry eye or establish the cause of redness.
- Describe only quality limitations supported by the data. If quality details
  are missing, say they are unavailable; do not pretend to have seen the media.
- Suggestions must be general, cautious, relevant to the supplied data, and
  understandable to a patient. Do not prescribe medication.
- If findings conflict, explain that the methods differ and are not interchangeable.
- Include appropriate professional-care guidance.
- Sudden vision changes or severe eye pain warrant urgent medical assessment.
- Do not generate a combined clinical score.
- Return only valid JSON, with no Markdown fences.

Return this schema:
{{
  "plain_language_summary": "Short explanation for the patient",
  "osdi_explanation": "Explain the supplied OSDI result and its limitations",
  "video_quality": "Video visibility and limitations, or unavailable",
  "image_quality": "Image quality and limitations, or unavailable",
  "interpretation_limitations": ["Limitation supported by supplied data"],
  "personalized_suggestions": ["Practical, cautious suggestion"],
  "professional_care_guidance": "When professional assessment is appropriate",
  "urgent_warning_signs": ["Warning sign and appropriate action"],
  "confidence_and_uncertainty": "What can and cannot be concluded"
}}

Keep each list to at most 8 items. Use plain language and do not overstate
the reliability of AI analysis.

ASSESSMENT DATA:
{payload}
"""

    try:
        # PDF creation must remain available even when Gemini is temporarily
        # unavailable or the API key/model has not been configured.
        if not settings.gemini_api_key or not settings.gemini_model:
            raise RuntimeError("Gemini report interpretation is not configured.")

        from google import genai
        from google.genai import types

        client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(
                timeout=settings.request_timeout_seconds * 1000
            ),
        )
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        raw = (response.text or "").strip()
        if not raw:
            raise ValueError("Gemini returned an empty report interpretation.")

        raw = re.sub(r"^\s*```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```\s*$", "", raw)
        result = json.loads(raw)

        required_strings = (
            "plain_language_summary",
            "osdi_explanation",
            "video_quality",
            "image_quality",
            "professional_care_guidance",
            "confidence_and_uncertainty",
        )
        required_lists = (
            "interpretation_limitations",
            "personalized_suggestions",
            "urgent_warning_signs",
        )
        for key in required_strings:
            if not isinstance(result.get(key), str):
                raise ValueError(f"Missing or invalid Gemini field: {key}")
        for key in required_lists:
            if not isinstance(result.get(key), list):
                raise ValueError(f"Missing or invalid Gemini field: {key}")
            result[key] = [str(x)[:1200] for x in result[key][:8]]

        return result

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Gemini report interpretation failed: %s", type(exc).__name__
        )
        # Keep the report available, but never fabricate Gemini output.
        # The PDF will clearly state that AI interpretation was unavailable.
        return {
            "plain_language_summary":
                "AI interpretation is unavailable for this report. "
                "Please retry when the Gemini service is available.",
            "osdi_explanation":
                "Gemini could not interpret this result. The displayed "
                "OSDI category, if present, is calculated by LacriLens "
                "using its configured score boundaries and is not a diagnosis.",
            "video_quality":
                "AI quality interpretation unavailable. Review the original "
                "video and retry analysis when the service is available.",
            "image_quality":
                "AI quality interpretation unavailable. Review the original "
                "images and retry analysis when the service is available.",
            "interpretation_limitations": [
                "Gemini report interpretation failed.",
                "No AI-generated personalized suggestions are available.",
            ],
            "personalized_suggestions": [],
            "professional_care_guidance":
                "If you have ongoing eye symptoms or concerns, contact a "
                "qualified eye-care professional.",
            "urgent_warning_signs": [
                "Sudden vision changes or severe eye pain require urgent "
                "medical assessment."
            ],
            "confidence_and_uncertainty":
                "No Gemini interpretation was available. This report cannot "
                "provide an AI-generated explanation or personalized suggestions.",
        }


def _report_card(story, title: str, body: str, styles,
                 background="#F3F7FA"):
    """Add page-splittable report content.

    Avoid wrapping long paragraphs in a single-cell Table: ReportLab cannot
    split an oversized table row across pages and raises LayoutError.
    The background parameter is retained for call-site compatibility.
    """
    story.append(Paragraph(escape(title), styles["CardTitle"]))
    story.append(Paragraph(body or "Not provided.", styles["BodyText"]))
    story.append(Spacer(1, 3 * mm))


def _report_bullets(items) -> str:
    if not items:
        return "No additional points were provided."
    return "<br/>".join("&#8226; " + _report_escape(item) for item in items)


@app.post("/api/generate-report")
def generate_report(request: ReportRequest):
    """Create a readable PDF with Gemini-generated interpretation."""
    assessments = request.assessments

    # Gemini generates the narrative and suggestions using the supplied data.
    # The OSDI category itself is always calculated by deterministic code.
    interpretation = generate_gemini_report_interpretation(assessments)

    osdi_data = assessments.get("osdi", assessments.get("OSDI", {}))
    raw_score = _find_report_value(osdi_data, "score", "osdiScore")
    osdi = _osdi_category(raw_score)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=17 * mm,
        bottomMargin=18 * mm,
        title="LacriLens Patient-Friendly Screening Report",
        author="LacriLens",
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="ReportTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=27,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#172A46"),
        spaceAfter=3 * mm,
    ))
    styles.add(ParagraphStyle(
        name="ReportSubtitle",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#52657D"),
        spaceAfter=7 * mm,
    ))
    styles.add(ParagraphStyle(
        name="ReportHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#172A46"),
        spaceBefore=4 * mm,
        spaceAfter=3 * mm,
    ))
    styles.add(ParagraphStyle(
        name="CardTitle",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#172A46"),
        spaceAfter=2 * mm,
    ))
    styles.add(ParagraphStyle(
        name="SmallNote",
        parent=styles["BodyText"],
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#52657D"),
    ))

    story = [
        Paragraph("LacriLens", styles["ReportTitle"]),
        Paragraph(
            "Patient-friendly eye-comfort screening report",
            styles["ReportSubtitle"],
        ),
        Paragraph("1. Your screening summary", styles["ReportHeading"]),
    ]

    score_text = (
        f"{osdi['score']:g} / 100"
        if osdi["score"] is not None else "Not available"
    )
    _report_card(
        story,
        f"OSDI score: {score_text}",
        f"<b>Questionnaire category:</b> {_report_escape(osdi['category'])}"
        f"<br/><br/><b>What your result means:</b><br/>"
        f"{_report_escape(interpretation['osdi_explanation'])}"
        f"<br/><br/><b>Summary:</b><br/>"
        f"{_report_escape(interpretation['plain_language_summary'])}",
        styles,
        "#EDF6F5",
    )
    story.append(Paragraph(
        "LacriLens OSDI bands: 0-12 normal/minimal, 13-22 mild, "
        "23-32 moderate, 33-100 severe symptoms. These are symptom categories, "
        "not a confirmed diagnosis.",
        styles["SmallNote"],
    ))

    story.append(Paragraph(
        "2. Your recorded assessment results", styles["ReportHeading"]
    ))
    for name, value in assessments.items():
        if str(name).lower() == "osdi":
            continue
        title = str(name).replace("_", " ").strip().title()
        _report_card(story, title, _report_escape(value), styles)

    story.append(PageBreak())
    story.append(Paragraph(
        "3. Video and image quality", styles["ReportHeading"]
    ))
    _report_card(
        story, "Video quality and limitations",
        _report_escape(interpretation["video_quality"]), styles
    )
    _report_card(
        story, "Eye-image quality and limitations",
        _report_escape(interpretation["image_quality"]), styles
    )
    _report_card(
        story, "Interpretation limitations",
        _report_bullets(interpretation["interpretation_limitations"]), styles
    )
    _report_card(
        story, "Confidence and uncertainty",
        _report_escape(interpretation["confidence_and_uncertainty"]), styles
    )

    story.append(PageBreak())
    story.append(Paragraph(
        "4. Suggestions based on your results", styles["ReportHeading"]
    ))
    _report_card(
        story, "Personalized suggestions generated by Gemini",
        _report_bullets(interpretation["personalized_suggestions"]),
        styles, "#EDF6F5"
    )
    _report_card(
        story, "Professional care guidance",
        _report_escape(interpretation["professional_care_guidance"]), styles
    )
    _report_card(
        story, "Urgent warning signs",
        _report_bullets(interpretation["urgent_warning_signs"]),
        styles, "#FFF5E8"
    )

    story.append(Paragraph(
        "Important limitations", styles["ReportHeading"]
    ))
    story.append(Paragraph(
        _report_escape(request.disclaimer), styles["BodyText"]
    ))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        "LacriLens is a screening prototype, not a diagnostic device. "
        "The OSDI category uses fixed score boundaries. AI-generated text "
        "may be inaccurate and does not replace professional assessment. "
        "Blink results are not combined into a clinical score.",
        styles["SmallNote"],
    ))

    try:
        doc.build(story)
    except Exception as exc:
        logger.exception("PDF report generation failed")
        raise HTTPException(
            status_code=500,
            detail="The PDF report could not be generated.",
        ) from exc

    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="lacrilens-report.pdf"'
        },
    )
