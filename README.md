# LacriLens V1 — AI-Assisted Dry Eye Assessment

LacriLens is a web-based prototype designed to explore dry eye symptom assessment using a structured questionnaire, blink-rate measurement, video-based eye-closure analysis, and AI-assisted eye-image observations.

The project combines a React and TypeScript frontend with a FastAPI backend and Google's Gemini API for AI-assisted analysis.

> **Disclaimer:** LacriLens is an experimental, non-diagnostic prototype. It is not a substitute for professional eye examination, clinical evaluation, or medical advice. Its outputs have not been established as clinically validated diagnostic results.

## Overview

Dry eye symptoms can include irritation, grittiness, light sensitivity, discomfort, and visual disturbances. LacriLens brings together multiple sources of information in one application to help users explore their symptoms and review preliminary observations.

### Key Features

- **OSDI Questionnaire:** Collects responses to the 12-item Ocular Surface Disease Index questionnaire and calculates a symptom score.
- **Manual Blink-Rate Test:** Records a manually counted blink total over 20 seconds and calculates blinks per minute.
- **Video-Based Eye-Closure Analysis:** Captures a short webcam recording for AI-assisted analysis of visible eye closure and estimated blinking patterns.
- **Eye-Image Observations:** Accepts eye images for qualitative, AI-assisted observations, including visible redness and image-quality limitations.
- **PDF Report Generation:** Combines available assessment results and interpretations into a downloadable report when the required assessment results are available.
- **Session-Based Workflow:** Maintains assessment progress in browser memory without requiring user accounts or persistent patient-history storage.

## Assessment Modules

### 1. OSDI Questionnaire

The questionnaire contains 12 items covering eye symptoms, functional limitations, and environmental discomfort.

Responses are scored from 0 to 4. Questions marked not applicable are excluded from the score calculation where permitted.

The OSDI score is calculated as:

`OSDI = (Sum of scored responses × 100) / (Number of scored responses × 4)`

The prototype uses the following symptom categories:

| Score | Category |
|---|---|
| 0–12 | Normal / Minimal |
| 13–22 | Mild |
| 23–32 | Moderate |
| 33–100 | Severe |

These categories represent the application's configured interpretation and should not be treated as a clinical diagnosis.

### 2. Manual Blink-Rate Measurement

The user counts blinks during a 20-second test.

`Blink rate (BPM) = Blink count × 3`

The result is an estimate based on the manually entered count and may be affected by counting errors and testing conditions.

### 3. Video-Based Eye-Closure Analysis

The application captures a short webcam recording and sends it to the FastAPI backend for Gemini-assisted analysis.

The intended capture duration is 10 seconds, with a target capture rate of 30 frames per second. Video sampling and blink estimation require validation against labelled recordings before they can be considered reliable measurements.

AI-generated estimates may be incomplete or uncertain. Numeric blink metrics should only be displayed when the application receives and validates usable values.

### 4. Eye-Image Observations

Users can provide left-eye and right-eye images for qualitative AI-assisted observations.

The analysis may describe visible features such as redness, image quality, and limitations that affect interpretation. Image observations are not measurements of tear-film stability and cannot independently establish a dry eye diagnosis.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS |
| Backend | Python, FastAPI |
| AI integration | Google Gemini API via the backend |
| Report generation | ReportLab |
| Testing | Pytest, FastAPI TestClient |
| Version control | Git and GitHub |

## System Architecture

```text
User
  |
  v
React + TypeScript Frontend
  |
  | HTTP requests
  v
FastAPI Backend
  |
  +---- OSDI and assessment processing
  |
  +---- Eye-image analysis
  |
  +---- Video eye-closure analysis
  |
  +---- PDF report generation
  |
  v
Google Gemini API
  |
  v
AI-assisted observations and interpretations
```

The Gemini API key is stored on the backend and must never be exposed in frontend code or committed to GitHub.

## Project Structure

```text
LacriLens_V1/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   └── services/
│   │       └── video_sampling.py
│   ├── tests/
│   │   ├── test_api.py
│   │   ├── test_health.py
│   │   └── test_video_sampling.py
│   ├── .env.example
│   └── requirements.txt
├── docs/
│   └── IMPLEMENTATION_PLAN.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

Install the following before running the application:

- Python 3.11 or another Python version compatible with the project's dependencies
- Node.js and npm
- Git
- A Google Gemini API key for AI-assisted functionality

Run the commands below from PowerShell on Windows.

### 1. Clone the Repository

```powershell
git clone https://github.com/aravind-sai-billa/LacriLens.git
cd LacriLens
```

### 2. Set Up the Backend

Create and activate a virtual environment:

```powershell
cd backend

python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install the dependencies:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create the local environment file from the template:

```powershell
Copy-Item .env.example .env
```

Open `backend/.env` and configure the Gemini API key and model settings according to the environment template.

**Security:** Keep the real `.env` file local. Never commit or share your API key.

Start the backend:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend should be available at:

- API base URL: `http://127.0.0.1:8000`
- Health check: `http://127.0.0.1:8000/health`
- Readiness check: `http://127.0.0.1:8000/ready`
- Interactive API documentation: `http://127.0.0.1:8000/docs`

Keep the backend terminal running.

### 3. Set Up the Frontend

Open a second PowerShell terminal:

```powershell
cd D:\aravind_sai\Projects\LacriLens_V1\frontend

npm install
npm run dev
```

Open the local URL printed by Vite, typically:

`http://localhost:5173`

Keep the frontend and backend running in separate terminals while using the application.

If you clone the project into a different directory, adjust the frontend path accordingly.

## Backend API Endpoints

The current backend exposes the following routes:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Checks backend health |
| GET | `/ready` | Checks application readiness |
| POST | `/api/analyze-image` | Performs AI-assisted eye-image analysis |
| POST | `/api/analyze-closure` | Performs AI-assisted video eye-closure analysis |
| POST | `/api/generate-report` | Generates a PDF assessment report |

For request schemas, response structures, and interactive testing, start the backend and visit `/docs`.

AI-dependent endpoints require valid server-side configuration and network access to the Gemini API.

## Running Tests

Activate the backend virtual environment, navigate to the backend directory, and run:

```powershell
cd D:\aravind_sai\Projects\LacriLens_V1\backend

.\.venv\Scripts\Activate.ps1
python -m pytest -v
```

The backend test suite previously passed all 12 tests in the development environment. Run the tests again after making changes to confirm the current result.

To check whether the frontend builds successfully:

```powershell
cd D:\aravind_sai\Projects\LacriLens_V1\frontend

npm run build
```

## Privacy and Security

- The Gemini API key must remain on the backend.
- Local environment files, virtual environments, dependencies, and generated build files are excluded through `.gitignore`.
- The current prototype does not require user login or implement persistent patient-history storage.
- Assessment state is held in browser memory and may be lost when the page is refreshed.
- Images and recordings submitted for AI analysis are sent to the configured backend and may be transmitted to the external AI provider for processing.
- Do not upload real patient images, identifiable health information, or other sensitive medical data to a development environment without appropriate authorization and privacy safeguards.

## Current Limitations

LacriLens V1 is an evolving engineering prototype. Current limitations include:

- Blink-rate estimates from video require validation against manually labelled recordings.
- AI-generated observations can be uncertain, incomplete, or incorrect.
- Eye-image observations do not establish a clinical diagnosis.
- Browser refreshes may discard in-progress assessment state.
- Clinical performance, diagnostic accuracy, and suitability for real-world medical use have not been established.
- AI-dependent features require valid backend configuration and an available Gemini API service.

## Future Development

Potential development priorities include:

- Validating blink detection and video sampling against labelled datasets.
- Improving structured AI responses and numeric metric validation.
- Improving report readability and personalized, evidence-aware recommendations.
- Strengthening automated tests and error handling.
- Improving session-state management and assessment-result consistency.
- Evaluating usability, privacy, and clinical requirements before any real-world deployment.

## Disclaimer

LacriLens is intended for educational and experimental software development. It does not provide a medical diagnosis, replace a qualified eye-care professional, or guarantee the accuracy of AI-generated results. Users with persistent, worsening, or concerning eye symptoms should seek assessment from a qualified eye-care professional.

## Repository

Source code: https://github.com/aravind-sai-billa/LacriLens
