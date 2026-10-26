import { useEffect, useState } from 'react';
import AssessmentLayout from './AssessmentLayout';

type ManualBlinkResult = {
  assessment: 'manual_blink';
  blinkCount: number;
  bpm: number;
  durationSeconds: number;
  method: 'manual_count';
  isDiagnosis: false;
};

export default function ManualBlinkPage({
  onPrevious,
  onComplete,
  onSkip,
}: {
  onPrevious: () => void;
  onComplete: (result: ManualBlinkResult) => void;
  onSkip: () => void;
}) {
  const [seconds, setSeconds] = useState(20);
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const [countInput, setCountInput] = useState('0');
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => {
      setSeconds(value => {
        if (value <= 1) {
          window.clearInterval(timer);
          setRunning(false);
          setFinished(true);
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running]);

  function updateCount(value: number) {
    const safeValue = Math.max(0, Math.floor(value));
    setCount(safeValue);
    setCountInput(String(safeValue));
    setError('');
  }

  function reset() {
    setSeconds(20);
    setRunning(false);
    setFinished(false);
    updateCount(0);
    setError('');
  }

  function saveResult() {
    if (!finished) {
      setError('Complete the 20-second test before saving.');
      return;
    }

    const parsed = Number(countInput);
    if (!Number.isInteger(parsed) || parsed < 0 || countInput.trim() === '') {
      setError('Enter a valid whole-number blink count of zero or more.');
      return;
    }

    onComplete({
      assessment: 'manual_blink',
      blinkCount: parsed,
      bpm: parsed * 3,
      durationSeconds: 20,
      method: 'manual_count',
      isDiagnosis: false,
    });
  }

  return (
    <AssessmentLayout
      title="Manual blink test"
      subtitle="Count each complete blink during the 20-second test. After the timer stops, you can enter or correct your final count."
      onPrevious={onPrevious}
      onSkip={onSkip}
      nextLabel="Save result"
      onNext={saveResult}
    >
      <div className="rounded-2xl bg-slate-50 p-6 text-center">
        <p className="text-sm text-slate-500">Time remaining</p>
        <p className="my-3 text-6xl font-semibold tabular-nums">
          {`00:${String(seconds).padStart(2, '0')}`}
        </p>

        <p className="text-slate-600">Blink count</p>
        <p className="my-2 text-4xl font-semibold tabular-nums">{count}</p>

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            disabled={running || finished}
            onClick={() => {
              setError('');
              setRunning(true);
            }}
            className="rounded-xl bg-ink px-5 py-3 font-medium text-white disabled:opacity-40"
          >
            {seconds === 20 && !running && !finished ? 'Start 20-second test' : 'Resume timer'}
          </button>

          <button
            disabled={!running}
            onClick={() => updateCount(count + 1)}
            className="rounded-xl border border-teal px-5 py-3 font-medium text-teal disabled:opacity-40"
          >
            Count blink +1
          </button>

          <button
            onClick={reset}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium"
          >
            Reset test
          </button>
        </div>
      </div>

      {finished && (
        <div className="mt-5 rounded-xl border border-teal/30 bg-teal/5 p-4">
          <p className="font-semibold">Test complete — confirm your count</p>
          <label className="mt-3 block text-sm font-medium" htmlFor="manual-blink-count">
            Final blink count
          </label>
          <input
            id="manual-blink-count"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={countInput}
            onChange={event => {
              setCountInput(event.target.value);
              const value = Number(event.target.value);
              if (event.target.value.trim() !== '' && Number.isInteger(value) && value >= 0) {
                setCount(value);
              }
              setError('');
            }}
            onBlur={() => {
              const value = Number(countInput);
              if (countInput.trim() !== '' && Number.isInteger(value) && value >= 0) {
                updateCount(value);
              }
            }}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-lg"
          />
          <p className="mt-3 text-slate-600">
            Calculated blink rate: <strong>{count * 3} blinks/minute</strong>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Formula for this 20-second test: blink count × 3. Confirm the count before saving.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </p>
      )}
    </AssessmentLayout>
  );
}
