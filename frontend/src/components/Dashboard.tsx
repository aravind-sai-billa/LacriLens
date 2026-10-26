
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Eye,
  FileText,
  ShieldCheck,
  Video,
} from 'lucide-react';

type AssessmentId = 'osdi' | 'manual' | 'video' | 'image';

type AssessmentState = {
  status: 'pending' | 'completed' | 'skipped';
  hasUsableResult: boolean;
};

type DashboardProps = {
  onStart: () => void;
  onResume: () => void;
  hasUnfinishedSession: boolean;
  sessionStarted: boolean;
  onPrivacy: () => void;
  assessments: Record<AssessmentId, AssessmentState>;
  onRetake: (id: AssessmentId) => void;
};

const assessmentCards: {
  id: AssessmentId;
  number: string;
  title: string;
  detail: string;
  icon: typeof ClipboardList;
}[] = [
  {
    id: 'osdi',
    number: '01',
    title: 'OSDI questionnaire',
    detail: '12 questions about eye symptoms and daily activities',
    icon: ClipboardList,
  },
  {
    id: 'manual',
    number: '02',
    title: 'Manual blink test',
    detail: 'Count blinks during a guided 20-second test',
    icon: Activity,
  },
  {
    id: 'video',
    number: '03',
    title: 'Gemini video analysis',
    detail: '10-second webcam capture and AI-assisted observations',
    icon: Video,
  },
  {
    id: 'image',
    number: '04',
    title: 'Eye-image analysis',
    detail: 'Qualitative analysis of an uploaded eye image',
    icon: Eye,
  },
];

export default function Dashboard({
  onStart,
  onResume,
  hasUnfinishedSession,
  sessionStarted,
  onPrivacy,
  assessments,
  onRetake,
}: DashboardProps) {
  const hasRetakeOptions = assessmentCards.some(
    (assessment) =>
      assessments[assessment.id].status === 'completed' &&
      assessments[assessment.id].hasUsableResult,
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 md:py-16">
      <div className="grid gap-10 md:grid-cols-[1.1fr_.9fr] md:items-center">
        <section>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[.18em] text-teal">
            Understand your eye comfort
          </p>

          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            A guided starting point for understanding dry-eye symptoms.
          </h1>

          <p className="mt-5 max-w-xl leading-7 text-slate-600">
            Complete four structured assessments to explore your symptoms,
            manual blink rate, AI-assisted eye-closure observations, and
            optional eye-image findings.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            {!sessionStarted && (
              <button
                onClick={onStart}
                className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 font-medium text-white transition hover:opacity-90"
              >
                Start screening <ArrowRight size={17} />
              </button>
            )}

            {hasUnfinishedSession && (
              <button
                onClick={onResume}
                className="inline-flex items-center gap-2 rounded-xl border border-teal px-5 py-3 font-medium text-teal transition hover:bg-teal/5"
              >
                Resume screening <ArrowRight size={17} />
              </button>
            )}

            <button
              onClick={onPrivacy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium transition hover:bg-slate-50"
            >
              <ShieldCheck size={17} /> Privacy & limitations
            </button>
          </div>

          {hasRetakeOptions && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold">Retake an assessment</h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                Retaking an assessment invalidates its previous result.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {assessmentCards
                  .filter(
                    (assessment) =>
                      assessments[assessment.id].status === 'completed' &&
                      assessments[assessment.id].hasUsableResult,
                  )
                  .map((assessment) => (
                    <button
                      key={assessment.id}
                      onClick={() => onRetake(assessment.id)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium transition hover:bg-slate-50"
                    >
                      Retake {assessment.title}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <p className="mt-4 text-sm leading-6 text-slate-500">
            No account required. Session progress is held in memory during this
            visit and is not saved as patient history.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Your screening pathway</h2>
            <span className="text-xs text-slate-500">4 assessments</span>
          </div>

          <div className="mt-5 space-y-3">
            {assessmentCards.map(({ id, number, title, detail, icon: Icon }) => {
              const assessment = assessments[id];

              return (
                <div
                  key={id}
                  className="flex items-start gap-4 rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-teal">
                    <Icon size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium">{title}</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-500">
                      {detail}
                    </p>

                    {assessment.status === 'completed' &&
                      assessment.hasUsableResult && (
                        <p className="mt-2 text-xs font-medium text-teal">
                          Completed · Result available
                        </p>
                      )}

                    {assessment.status === 'skipped' && (
                      <p className="mt-2 text-xs font-medium text-amber-600">
                        Skipped · Not completed
                      </p>
                    )}
                  </div>

                  <span className="pt-1 text-xs text-slate-400">{number}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-5 text-slate-600">
            <FileText size={18} className="mt-0.5 shrink-0 text-teal" />
            <p>
              Your combined report becomes available only when all four
              assessments have current, usable results.
            </p>
          </div>
        </section>
      </div>

      <footer className="mt-12 border-t border-slate-200 pt-5 text-sm leading-6 text-slate-500">
        LacriLens is a preliminary screening prototype, not a diagnostic tool.
        AI observations may be incomplete or incorrect and do not replace
        professional eye care.
      </footer>
    </main>
  );
}
