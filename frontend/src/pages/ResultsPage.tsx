import { useState } from 'react';
import AssessmentLayout from './AssessmentLayout';

const API_BASE = 'http://127.0.0.1:8000';

type AssessmentRecord = {
  status: 'pending' | 'completed' | 'skipped';
  hasUsableResult: boolean;
  result?: unknown;
};

export default function ResultsPage({
  onPrevious,
  onHome,
  ready,
  assessments,
}: {
  onPrevious: () => void;
  onHome: () => void;
  ready: boolean;
  assessments: Record<string, AssessmentRecord>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function downloadReport() {
    if (!ready) {
      setError('Complete all four assessments before generating the report.');
      return;
    }

    const reportData: Record<string, unknown> = {};

    for (const [id, assessment] of Object.entries(assessments)) {
      if (assessment.status !== 'completed' || !assessment.hasUsableResult || assessment.result == null) {
        setError(`The ${id} assessment has no current usable result.`);
        return;
      }
      reportData[id] = assessment.result;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_BASE}/api/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessments: reportData }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || `Report generation failed (HTTP ${response.status}).`);
      }

      const pdfBlob = await response.blob();

      if (pdfBlob.size === 0 || pdfBlob.type !== 'application/pdf') {
        throw new Error('The backend did not return a valid PDF file.');
      }

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'lacrilens-report.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setMessage('PDF report downloaded. Review its limitations and consult an eye-care professional for concerns.');
    } catch (err) {
      setError(err instanceof Error
        ? err.message
        : 'Could not connect to the report service.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AssessmentLayout
      title="Results and PDF report"
      subtitle="Review the status of your four screening assessments. The report contains supplied results and does not create a combined clinical score."
      onPrevious={onPrevious}
      onSkip={onHome}
      nextLabel="Back to dashboard"
      onNext={onHome}
    >
      {ready ? (
        <div className="rounded-xl border border-teal/30 bg-teal/5 p-4">
          <p className="font-semibold">All four assessments have usable results</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            You can generate a PDF summary of the current session. The report is a screening aid, not a diagnosis.
          </p>
          <button
            type="button"
            onClick={downloadReport}
            disabled={loading}
            className="mt-4 rounded-xl bg-ink px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Generating PDF…' : 'Download PDF report'}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">PDF report unavailable</p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            All four assessments must have current, usable results. Skipped or placeholder assessments do not qualify.
          </p>
        </div>
      )}

      {message && <p className="mt-4 rounded-lg bg-teal/10 p-3 text-sm text-teal" role="status">{message}</p>}
      {error && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="alert">{error}</p>}

      <div className="mt-5 space-y-3">
        {Object.entries(assessments).map(([id, assessment]) => (
          <div key={id} className="rounded-lg border border-slate-200 p-3">
            <p className="font-medium capitalize">{id === 'osdi' ? 'OSDI questionnaire' : id === 'manual' ? 'Manual blink test' : id === 'video' ? 'Video analysis' : 'Eye-image analysis'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {assessment.status === 'completed' && assessment.hasUsableResult
                ? 'Completed with a usable result'
                : assessment.status === 'skipped'
                  ? 'Skipped'
                  : 'Incomplete'}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs leading-5 text-slate-500">
        No patient history is saved by this page. Refreshing the browser clears the in-memory session.
        Seek professional evaluation for persistent or concerning symptoms.
      </p>
    </AssessmentLayout>
  );
}
