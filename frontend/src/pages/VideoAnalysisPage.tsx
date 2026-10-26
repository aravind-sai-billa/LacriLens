import { useEffect, useRef, useState } from 'react';
import AssessmentLayout from './AssessmentLayout';

const API_BASE = 'http://127.0.0.1:8000';

type ApiResult = {
  status: string;
  assessment: string;
  model: string;
  result: string;
  blink_count?: number | null;
  blink_rate_bpm?: number | null;
  blink_metrics_status?: string;
  is_diagnosis: false;
};

export default function VideoAnalysisPage({
  onPrevious,
  onComplete,
  onSkip,
}: {
  onPrevious: () => void;
  onComplete: (result: ApiResult) => void;
  onSkip: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const [consent, setConsent] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(10);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reportedFps, setReportedFps] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<ApiResult | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreamReady(false);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  async function enableCamera() {
    setError('');
    setMessage('');

    if (!consent) {
      setError('Consent is required before camera capture.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is unavailable. Use a supported browser on localhost or HTTPS.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { frameRate: { ideal: 30 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setReportedFps(stream.getVideoTracks()[0]?.getSettings().frameRate ?? null);
      setStreamReady(true);
    } catch {
      stopCamera();
      setError('Camera access failed. Check browser permissions and whether another app is using the camera.');
    }
  }

  function startRecording() {
    if (!streamRef.current || !consent || recording) return;

    if (typeof MediaRecorder === 'undefined') {
      setError('Video recording is not supported by this browser.');
      return;
    }

    const preferredType = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ].find(type => MediaRecorder.isTypeSupported(type));

    try {
      chunksRef.current = [];
      setRecordedBlob(null);
      setAnalysis(null);
      setError('');
      setMessage('');

      const recorder = preferredType
        ? new MediaRecorder(streamRef.current, { mimeType: preferredType })
        : new MediaRecorder(streamRef.current);

      recorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setError('Recording failed. Please enable the camera and try again.');
        setRecording(false);
        stopCamera();
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        });
        setRecordedBlob(blob);
        setRecording(false);
        stopCamera();
      };

      recorder.start();
      setRecording(true);
      setSeconds(10);

      let remaining = 10;
      timerRef.current = window.setInterval(() => {
        remaining -= 1;
        setSeconds(remaining);

        if (remaining <= 0) {
          if (timerRef.current !== null) window.clearInterval(timerRef.current);
          timerRef.current = null;
          if (recorder.state === 'recording') recorder.stop();
        }
      }, 1000);
    } catch {
      setError('Could not start video recording. Please try again.');
      stopCamera();
    }
  }

  async function submitForAnalysis() {
    if (!consent) {
      setError('Consent is required before submitting the clip.');
      return;
    }

    if (!recordedBlob || recordedBlob.size === 0) {
      setError('Record a 10-second clip first.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const mimeType = recordedBlob.type.split(';')[0] || 'video/webm';
      const extension = mimeType === 'video/mp4' ? 'mp4'
        : mimeType === 'video/quicktime' ? 'mov' : 'webm';

      const file = new File([recordedBlob], `eye-clip.${extension}`, { type: mimeType });
      const body = new FormData();
      body.append('file', file);

      const response = await fetch(`${API_BASE}/api/analyze-closure`, {
        method: 'POST',
        body,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.detail || `Analysis failed (HTTP ${response.status}).`);
      }

      if (
        payload.status !== 'success' ||
        typeof payload.result !== 'string' ||
        !payload.result.trim()
      ) {
        throw new Error('The backend did not return a usable analysis result.');
      }

      setAnalysis(payload as ApiResult);
      setMessage('Gemini analysis is ready. Review it below before saving and continuing.');
    } catch (err) {
      setError(err instanceof Error
        ? err.message
        : 'Could not connect to the backend. Check that FastAPI is running.');
    } finally {
      setLoading(false);
    }
  }

  function saveAndContinue() {
    if (!analysis) {
      setError('Analyze the recorded clip and review the result before continuing.');
      return;
    }
    onComplete(analysis);
  }

  return (
    <AssessmentLayout
      title="Gemini video analysis"
      subtitle="Record a 10-second webcam clip and review Gemini's observations on this page before saving the assessment."
      onPrevious={onPrevious}
      onSkip={onSkip}
      nextLabel={analysis ? 'Save result and continue' : loading ? 'Analyzing…' : 'Analyze recorded clip'}
      onNext={analysis ? saveAndContinue : submitForAnalysis}
    >
      <label className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6">
        <input
          type="checkbox"
          checked={consent}
          disabled={loading || recording}
          onChange={event => setConsent(event.target.checked)}
          className="mt-1"
        />
        I consent to webcam capture and processing of this clip for screening assistance.
      </label>

      <video
        ref={videoRef}
        muted
        playsInline
        className="mt-5 aspect-video w-full rounded-xl bg-slate-950 object-cover"
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={enableCamera}
          disabled={!consent || streamReady || recording || loading || Boolean(analysis)}
          className="rounded-xl border border-slate-300 px-4 py-3 font-medium disabled:opacity-40"
        >
          Enable camera
        </button>
        <button
          onClick={startRecording}
          disabled={!streamReady || recording || loading}
          className="rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-40"
        >
          Record 10 seconds
        </button>
      </div>

      {recording && (
        <p className="mt-3 font-medium" role="status">Recording… {seconds}s remaining</p>
      )}

      {recordedBlob && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4 text-sm">
          <p>Clip captured: {(recordedBlob.size / 1024).toFixed(1)} KB</p>
          <p>
            Browser-reported camera frame rate:{' '}
            {reportedFps == null ? 'Not provided' : `${reportedFps} FPS`}
          </p>
          <p className="mt-2 text-slate-500">
            This is the browser-reported camera setting, not a verified count of analyzed frames.
          </p>
          <button
            onClick={submitForAnalysis}
            disabled={loading || Boolean(analysis)}
            className="mt-3 rounded-lg border border-teal px-3 py-2 font-medium text-teal disabled:opacity-50"
          >
            {loading ? 'Sending to Gemini…' : analysis ? 'Analysis complete' : 'Analyze recorded clip'}
          </button>
          {analysis && (
            <button
              onClick={() => {
                setAnalysis(null);
                setMessage('');
                setError('');
              }}
              className="ml-2 mt-3 rounded-lg border border-slate-300 px-3 py-2 font-medium"
            >
              Analyze again
            </button>
          )}
        </div>
      )}

      {loading && (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm" role="status">
          Uploading the clip and waiting for Gemini. This may take a little while.
        </p>
      )}

      {analysis && (
        <section className="mt-5 rounded-xl border border-teal/30 bg-teal/5 p-5">
          <h2 className="text-lg font-semibold">Gemini analysis result</h2>
          <p className="mt-1 text-xs text-slate-500">Model: {analysis.model}</p>

          {typeof analysis.blink_count === 'number' &&
           typeof analysis.blink_rate_bpm === 'number' ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white p-4">
                <p className="text-sm text-slate-500">AI-estimated blink count</p>
                <p className="mt-1 text-3xl font-semibold">{analysis.blink_count}</p>
              </div>
              <div className="rounded-lg bg-white p-4">
                <p className="text-sm text-slate-500">AI-estimated rate</p>
                <p className="mt-1 text-3xl font-semibold">{analysis.blink_rate_bpm} BPM</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700">
              A validated numeric blink count and BPM were not returned by the backend.
              Review Gemini's observations below; no numeric rate will be fabricated.
            </p>
          )}

          <h3 className="mt-5 font-semibold">AI-assisted observations</h3>
          <div className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-4 text-sm leading-6">
            {analysis.result}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            AI-generated observations may be inaccurate and are not a validated clinical
            measurement or a diagnosis.
          </p>
        </section>
      )}

      {message && (
        <p className="mt-4 rounded-lg bg-teal/10 p-3 text-sm text-teal" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          {error}
        </p>
      )}

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Gemini's current backend response is text-based. Numeric blink metrics are displayed
        only if the backend explicitly returns numeric fields.
      </p>
    </AssessmentLayout>
  );
}
