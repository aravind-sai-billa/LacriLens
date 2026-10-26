# LacriLens V1 — New Implementation

New baseline: React + Vite + TypeScript + Tailwind frontend; FastAPI backend; Gemini API key server-side only. Target webcam recording is 30 FPS for 10 seconds. Balanced sampling is provisional and must be validated against labeled clips. Manual blink test is 20 seconds with BPM = count × 3. No login or persistent patient history in V1; browser-memory session state may be lost on refresh.

## Start
Backend: `cd backend`, create/activate a virtual environment, `pip install -r requirements.txt`, copy `.env.example` to `.env`, then `uvicorn app.main:app --reload --port 8000`.
Frontend: `cd frontend`, `npm install`, `npm run dev`.

Do not commit `.env` or any real API key. The current scaffold is a starting point, not a completed or clinically validated screening system. See `docs/IMPLEMENTATION_PLAN.md`.
