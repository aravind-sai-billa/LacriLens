# LacriLens V1 — Structure and implementation plan

## Structure
```text
LacriLens_V1_New/
├── frontend/src/
│   ├── app/                 # six-page flow and navigation
│   ├── components/          # progress, stepper, consent, status
│   ├── features/
│   │   ├── dashboard/       # introduction, privacy, resume
│   │   ├── osdi/            # 12-item questionnaire
│   │   ├── manual-blink/    # 20-second timer and count
│   │   ├── video-analysis/  # 10-second camera capture
│   │   ├── eye-images/      # left/right image slots
│   │   └── report/           # results and PDF action
│   ├── lib/                 # typed API client
│   ├── types/               # session and assessment types
│   ├── App.tsx
│   └── main.tsx
├── backend/app/
│   ├── api/routes/          # health, video, images, report
│   ├── core/                # settings, errors, limits
│   ├── schemas/             # validated request/response types
│   ├── services/            # Gemini, sampling, assessment, PDF
│   └── main.py
├── backend/tests/
├── docs/IMPLEMENTATION_PLAN.md
└── README.md
```

## User flow
1. Dashboard / privacy information
2. OSDI questionnaire
3. Manual blink test
4. Gemini video analysis
5. Eye-image analysis
6. Results and PDF

## Architecture boundaries
- React handles UI, camera, previews, consent and volatile session progress.
- FastAPI validates inputs, calls Gemini, orchestrates analyses and creates PDF.
- Gemini API key stays on the backend.
- Gemini can estimate video blink events, describe visible eye-image features, interpret validated OSDI outputs and synthesize a narrative. It must communicate uncertainty and must not diagnose.
- Application code calculates OSDI using the verified formula, manual blink BPM, validates model outputs and gates report generation.
- Do not invent a combined numerical dry-eye score without a defensible and validated method.

## 30 FPS and balanced sampling
Request 30 FPS where supported, then inspect `MediaStreamTrack.getSettings()` and actual timestamps. A request does not guarantee 30 FPS. Record for 10 seconds. Start with a configurable evenly distributed sample (provisional: 30 frames over 10 seconds); preserve timestamps. Compare 15, 30 and denser sampling against labeled clips before deciding. Sparse samples can miss brief blinks. Warn/retake for inadequate duration, poor eye visibility or inadequate measured capture rate; set thresholds after device testing.

## Milestones
- M0 Foundation: clean UI, health/readiness endpoints, validated settings.
- M1 Reproduce baseline: Gemini connection, camera access, 30 FPS request/measurement, manual count × 3, error handling.
- M2 Assessments: OSDI with source-verified scoring; video and image analysis with consent, quality checks and typed schemas.
- M3 Flow: six pages, Back/Next, resume, progress, invalidate stale results when inputs change.
- M4 Report: only generate when all four assessments have current usable results; PDF is a snapshot and changes require regeneration.
- M5 Hardening: unit/API/E2E tests, CORS allowlist, rate limiting, upload caps, timeouts, safe errors, cleanup and labeled-video evaluation.

## Privacy and safeguards
No names/demographics, login or persistent patient history in V1. No localStorage/sessionStorage. Explicit consent before each Gemini-powered assessment. Do not log raw media, API keys or sensitive prompts. Add request limits and temporary-file cleanup before deployment. Software tests do not establish clinical validity.

## Open items before clinical logic is finalized
1. Verify original OSDI wording, answer values, N/A handling, formula and category boundaries from the approved source.
2. Confirm Gemini model and supported video/image input format, output schema and timeout behavior.
3. Define measured FPS/quality thresholds from browser tests.
4. Evaluate sampling performance using labeled clips.
