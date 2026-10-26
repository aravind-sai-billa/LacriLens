import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function AssessmentLayout({
  title, subtitle, children, onPrevious, onNext, onSkip, nextLabel = 'Next'
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
  nextLabel?: string;
}) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-teal">LacriLens V1 · Guided assessment</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 leading-6 text-slate-600">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <button onClick={onPrevious} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium">
          <ArrowLeft size={16}/> Previous
        </button>
        <div className="flex flex-wrap gap-3">
          <button onClick={onSkip} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium">Skip assessment</button>
          <button onClick={onNext} className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 font-medium text-white">
            {nextLabel} <ArrowRight size={16}/>
          </button>
        </div>
      </div>
    </section>
  );
}
