import { useState } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import Dashboard from './components/Dashboard';
import OsdiPage from './pages/OsdiPage';
import ManualBlinkPage from './pages/ManualBlinkPage';
import VideoAnalysisPage from './pages/VideoAnalysisPage';
import EyeImagePage from './pages/EyeImagePage';
import ResultsPage from './pages/ResultsPage';
import type { OsdiResult } from './pages/OsdiPage';

type Page = 'home' | 'osdi' | 'manual' | 'video' | 'image' | 'results';
type AssessmentId = Exclude<Page, 'home' | 'results'>;
type AssessmentStatus = 'pending' | 'completed' | 'skipped';

type AssessmentState = {
  status: AssessmentStatus;
  hasUsableResult: boolean;
  result?: unknown;
};

const steps: { id: AssessmentId; label: string; title: string }[] = [
  { id: 'osdi', label: 'OSDI', title: 'OSDI questionnaire' },
  { id: 'manual', label: 'Manual blink', title: 'Manual blink test' },
  { id: 'video', label: 'Video analysis', title: 'Gemini video analysis' },
  { id: 'image', label: 'Eye images', title: 'Eye-image analysis' },
];

const emptyAssessments = (): Record<AssessmentId, AssessmentState> => ({
  osdi: { status: 'pending', hasUsableResult: false },
  manual: { status: 'pending', hasUsableResult: false },
  video: { status: 'pending', hasUsableResult: false },
  image: { status: 'pending', hasUsableResult: false },
});

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [assessments, setAssessments] = useState(emptyAssessments);
  const [osdiAnswers, setOsdiAnswers] = useState<(number | null)[]>(Array(12).fill(null));

  const unfinished = steps.some(step => assessments[step.id].status !== 'completed');
  const hasUnfinishedSession = sessionStarted && sessionPaused && unfinished;

  const completedCount = steps.filter(step =>
    assessments[step.id].status === 'completed' && assessments[step.id].hasUsableResult
  ).length;

  const reportReady = steps.every(step =>
    assessments[step.id].status === 'completed' &&
    assessments[step.id].hasUsableResult &&
    assessments[step.id].result != null
  );

  function startScreening() {
    setSessionKey(value => value + 1);
    setAssessments(emptyAssessments());
    setOsdiAnswers(Array(12).fill(null));
    setSessionStarted(true);
    setSessionPaused(false);
    setPrivacyOpen(false);
    setPage('osdi');
  }

  function goHome() {
    if (sessionStarted && page !== 'home' && page !== 'results') {
      setSessionPaused(true);
    }
    setPage('home');
  }

  function resumeScreening() {
    if (!hasUnfinishedSession) return;
    const next = steps.find(step => assessments[step.id].status !== 'completed');
    setSessionPaused(false);
    setPage(next?.id ?? 'results');
  }

  function completeAssessment(id: AssessmentId, result: unknown) {
    if (result == null) return;

    setAssessments(current => ({
      ...current,
      [id]: { status: 'completed', hasUsableResult: true, result },
    }));

    const index = steps.findIndex(step => step.id === id);
    setPage(index < steps.length - 1 ? steps[index + 1].id : 'results');
    setSessionPaused(false);
  }

  function skipAssessment(id: AssessmentId) {
    setAssessments(current => ({
      ...current,
      [id]: { status: 'skipped', hasUsableResult: false },
    }));

    const index = steps.findIndex(step => step.id === id);
    const next = steps.slice(index + 1).find(step => currentStatus(step.id) !== 'completed');

    if (next) {
      setPage(next.id);
    } else {
      setSessionPaused(true);
      setPage('home');
    }

    function currentStatus(stepId: AssessmentId) {
      return assessments[stepId].status;
    }
  }

  function previous(id: AssessmentId) {
    const index = steps.findIndex(step => step.id === id);
    if (index > 0) setPage(steps[index - 1].id);
    else goHome();
  }

  function retake(id: AssessmentId) {
    if (!assessments[id].hasUsableResult) return;

    const index = steps.findIndex(step => step.id === id);
    setAssessments(current => {
      const next = { ...current };
      next[id] = { status: 'pending', hasUsableResult: false };
      steps.slice(index + 1).forEach(step => {
        next[step.id] = { status: 'pending', hasUsableResult: false };
      });
      return next;
    });

    // Remount the assessment views for a clean retake.
    setSessionKey(value => value + 1);
    if (id === 'osdi') setOsdiAnswers(Array(12).fill(null));
    setSessionPaused(false);
    setPage(id);
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <button onClick={goHome} className="flex items-center gap-3 text-left" aria-label="Return to dashboard">
            <div className="rounded-xl bg-ink p-2 text-white"><Eye size={22} /></div>
            <div>
              <div className="text-lg font-semibold">LacriLens</div>
              <div className="text-xs text-slate-500">PRELIMINARY EYE COMFORT SCREENING</div>
            </div>
          </button>
          <span className="rounded-full border border-teal/30 px-3 py-1 text-xs text-teal">Prototype · V1</span>
        </div>
      </header>

      {page === 'home' ? (
        <Dashboard
          onStart={startScreening}
          onResume={resumeScreening}
          hasUnfinishedSession={hasUnfinishedSession}
          sessionStarted={sessionStarted}
          onPrivacy={() => setPrivacyOpen(value => !value)}
          assessments={assessments}
          onRetake={retake}
        />
      ) : (
        <>
          <section className="mx-auto max-w-6xl px-6 pt-6">
            <button onClick={goHome} className="inline-flex items-center gap-2 text-sm text-slate-600">
              <ArrowLeft size={16} /> Dashboard
            </button>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">Assessment progress</h2>
                <span className="text-sm text-slate-500">{completedCount} of 4 completed</span>
              </div>
              <div className="mt-4 flex gap-2">
                {steps.map(step => {
                  const status = assessments[step.id].status;
                  return (
                    <div key={step.id} className="min-w-0 flex-1">
                      <div className={`h-2 rounded-full ${status === 'completed' ? 'bg-teal' : status === 'skipped' ? 'bg-amber-400' : 'bg-slate-100'}`} />
                      <p className="mt-2 truncate text-xs text-slate-500">
                        {step.label}{status === 'skipped' ? ' · Skipped' : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {sessionStarted && (
            <>
              <div key={`osdi-${sessionKey}`} className={page === 'osdi' ? '' : 'hidden'}>
                <OsdiPage
                  onPrevious={() => previous('osdi')}
                  onSkip={() => skipAssessment('osdi')}
                  savedAnswers={osdiAnswers}
                  savedResult={assessments.osdi.result as OsdiResult | undefined}
                  onAnswersChange={setOsdiAnswers}
                  onComplete={result => completeAssessment('osdi', result)}
                />
              </div>

              <div key={`manual-${sessionKey}`} className={page === 'manual' ? '' : 'hidden'}>
                <ManualBlinkPage
                  onPrevious={() => previous('manual')}
                  onSkip={() => skipAssessment('manual')}
                  onComplete={result => completeAssessment('manual', result)}
                />
              </div>

              <div key={`video-${sessionKey}`} className={page === 'video' ? '' : 'hidden'}>
                <VideoAnalysisPage
                  onPrevious={() => previous('video')}
                  onSkip={() => skipAssessment('video')}
                  onComplete={result => completeAssessment('video', result)}
                />
              </div>

              <div key={`image-${sessionKey}`} className={page === 'image' ? '' : 'hidden'}>
                <EyeImagePage
                  onPrevious={() => previous('image')}
                  onSkip={() => skipAssessment('image')}
                  onComplete={result => completeAssessment('image', result)}
                />
              </div>
            </>
          )}

          {page === 'results' && (
            <ResultsPage
              onPrevious={() => setPage('image')}
              onHome={goHome}
              ready={reportReady}
              assessments={assessments}
            />
          )}
        </>
      )}

      {privacyOpen && page === 'home' && (
        <div className="mx-auto max-w-6xl px-6 pb-8">
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
            LacriLens is a preliminary screening prototype, not a diagnosis. AI assessments require explicit consent.
            Session data remains in browser memory and is lost on refresh or tab close. Submitted media is processed
            by the configured backend and Gemini only after consent.
          </div>
        </div>
      )}
    </main>
  );
}
