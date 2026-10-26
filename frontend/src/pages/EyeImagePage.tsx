import { useState } from 'react';
import AssessmentLayout from './AssessmentLayout';

const API_BASE = 'http://127.0.0.1:8000';

type ImageAnalysis = {
  status: string;
  assessment: string;
  model: string;
  result: string;
  is_diagnosis: false;
};

export default function EyeImagePage({
  onPrevious,
  onComplete,
  onSkip,
}: {
  onPrevious: () => void;
  onComplete: (result: {
    status: string;
    assessment: string;
    results: ImageAnalysis[];
    is_diagnosis: false;
  }) => void;
  onSkip: () => void;
}) {
  const [consent, setConsent] = useState(false);
  const [left, setLeft] = useState<File | null>(null);
  const [right, setRight] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function acceptFile(file: File | undefined, side: 'left' | 'right') {
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowed.includes(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Each image must be 10 MB or smaller.');
      return;
    }

    setError('');
    if (side === 'left') setLeft(file);
    else setRight(file);
  }

  async function analyzeImages() {
    if (!consent) {
      setError('Consent is required before submitting images.');
      return;
    }

    const selected = [
      ...(left ? [{ side: 'Left eye', file: left }] : []),
      ...(right ? [{ side: 'Right eye', file: right }] : []),
    ];

    if (!selected.length) {
      setError('Upload at least one eye image.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const results: ImageAnalysis[] = [];

      for (const item of selected) {
        const body = new FormData();
        body.append('file', item.file, item.file.name);

        const response = await fetch(`${API_BASE}/api/analyze-image`, {
          method: 'POST',
          body,
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(`${item.side}: ${payload.detail || `Request failed (HTTP ${response.status}).`}`);
        }

        if (payload.status !== 'success' || typeof payload.result !== 'string' || !payload.result.trim()) {
          throw new Error(`${item.side}: backend did not return a usable analysis.`);
        }

        results.push({
          ...payload,
          assessment: item.side,
        } as ImageAnalysis);
      }

      onComplete({
        status: 'success',
        assessment: 'eye_image',
        results,
        is_diagnosis: false,
      });
    } catch (err) {
      setError(err instanceof Error
        ? err.message
        : 'Could not connect to the backend. Check that FastAPI is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AssessmentLayout
      title="Eye-image analysis"
      subtitle="Upload a clear image of the left and/or right eye for qualitative AI-assisted observations."
      onPrevious={onPrevious}
      onSkip={onSkip}
      nextLabel={loading ? 'Analyzing…' : 'Analyze selected images'}
      onNext={analyzeImages}
    >
      <label className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6">
        <input
          type="checkbox"
          checked={consent}
          disabled={loading}
          onChange={e => setConsent(e.target.checked)}
          className="mt-1"
        />
        I consent to submitting the selected eye images for AI-assisted screening analysis.
      </label>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="rounded-xl border border-dashed border-slate-300 p-5">
          <span className="font-medium">Left eye image</span>
          <input
            className="mt-3 block w-full text-sm"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={loading}
            onChange={e => acceptFile(e.target.files?.[0], 'left')}
          />
          <span className="mt-2 block text-xs text-slate-500">
            {left ? `${left.name} · ${(left.size / 1024).toFixed(0)} KB` : 'PNG, JPEG, WebP · max 10 MB'}
          </span>
        </label>

        <label className="rounded-xl border border-dashed border-slate-300 p-5">
          <span className="font-medium">Right eye image</span>
          <input
            className="mt-3 block w-full text-sm"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={loading}
            onChange={e => acceptFile(e.target.files?.[0], 'right')}
          />
          <span className="mt-2 block text-xs text-slate-500">
            {right ? `${right.name} · ${(right.size / 1024).toFixed(0)} KB` : 'PNG, JPEG, WebP · max 10 MB'}
          </span>
        </label>
      </div>

      {loading && (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm" role="status">
          Sending selected image(s) for analysis…
        </p>
      )}

      {error && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="alert">{error}</p>}

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Images are processed by the configured backend and AI provider. Observations are not a diagnosis.
        Unsubmitted images are not uploaded.
      </p>

      <button
        type="button"
        disabled={loading}
        className="mt-3 text-sm font-medium text-teal underline disabled:opacity-50"
        onClick={onSkip}
      >
        Continue without image analysis
      </button>
    </AssessmentLayout>
  );
}
