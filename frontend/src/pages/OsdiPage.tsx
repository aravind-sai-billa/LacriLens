import { useEffect, useState } from 'react';
import AssessmentLayout from './AssessmentLayout';

const QUESTIONS = [
  'Eyes that are sensitive to light?',
  'Eyes that feel gritty?',
  'Painful or sore eyes?',
  'Blurred vision?',
  'Poor vision?',
  'Have problems with your eyes limited you in performing reading?',
  'Have problems with your eyes limited you in performing driving at night?',
  'Have problems with your eyes limited you in performing working with a computer?',
  'Have problems with your eyes limited you in performing watching TV?',
  'Have your eyes felt uncomfortable in windy conditions?',
  'Have your eyes felt uncomfortable in places or areas with low humidity (very dry)?',
  'Have your eyes felt uncomfortable in areas that are air conditioned?',
];

const OPTIONS = [
  { value: 0, label: 'None of the time' },
  { value: 1, label: 'Some of the time' },
  { value: 2, label: 'Half of the time' },
  { value: 3, label: 'Most of the time' },
  { value: 4, label: 'All of the time' },
];

export type OsdiResult = {
  assessment: 'osdi';
  score: number;
  category: string;
  answers: (number | null)[];
  answeredQuestions: number;
  totalQuestions: number;
  scoringMethod: string;
  isDiagnosis: false;
};

type Props = {
  onPrevious: () => void;
  onComplete: (result: OsdiResult) => void;
  onSkip: () => void;
  savedAnswers: (number | null)[];
  savedResult?: OsdiResult;
  onAnswersChange: (answers: (number | null)[]) => void;
};

export default function OsdiPage({
  onPrevious,
  onComplete,
  onSkip,
  savedAnswers,
  savedResult,
  onAnswersChange,
}: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(savedAnswers);
  const [error, setError] = useState('');

  useEffect(() => {
    setAnswers(savedAnswers);
  }, [savedAnswers]);

  function chooseAnswer(index: number, value: number) {
    const next = answers.map((answer, i) => i === index ? value : answer);
    setAnswers(next);
    onAnswersChange(next);
    setError('');
  }

  function calculateScore() {
    const unanswered = answers.findIndex(answer => answer === null);
    if (unanswered !== -1) {
      setError(`Please answer Question ${unanswered + 1} before continuing.`);
      document.getElementById(`osdi-question-${unanswered}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }

    const scored = answers.filter(
      (answer): answer is number => answer !== null && answer !== -1
    );

    if (!scored.length) {
      setError('At least one scored answer is required.');
      return;
    }

    const sum = scored.reduce((total, answer) => total + answer, 0);
    const score = Math.round((sum * 100) / (scored.length * 4));

    let category: string;
    if (score <= 12) category = 'Normal / Minimal Symptoms';
    else if (score <= 22) category = 'Mild Symptoms';
    else if (score <= 32) category = 'Moderate Symptoms';
    else category = 'Severe Symptoms';

    onComplete({
      assessment: 'osdi',
      score,
      category,
      answers,
      answeredQuestions: scored.length,
      totalQuestions: 12,
      scoringMethod: 'sum of scored answers × 100 / (scored answer count × 4)',
      isDiagnosis: false,
    });
  }

  return (
    <AssessmentLayout
      title="OSDI questionnaire"
      subtitle="Answer all 12 questions. Questions 6–12 also allow N/A."
      onPrevious={onPrevious}
      onSkip={onSkip}
      nextLabel="Calculate OSDI score"
      onNext={calculateScore}
    >
      {savedResult && (
        <div className="mb-4 rounded-xl border border-teal/30 bg-teal/5 p-4 text-sm">
          <strong>Previously calculated score: {savedResult.score}/100</strong>
          <p className="mt-1">{savedResult.category}</p>
          <p className="mt-1 text-slate-500">Your answers have been restored. Recalculate after changing them.</p>
        </div>
      )}

      <div className="mb-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Select one frequency for every question. N/A is available only for questions 6–12.
        This questionnaire is a screening aid, not a diagnosis.
      </div>

      <div className="space-y-5">
        {QUESTIONS.map((question, index) => (
          <fieldset
            id={`osdi-question-${index}`}
            key={question}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <legend className="px-1 font-semibold leading-6">
              {index + 1}. {question}
            </legend>

            <div className="mt-3 space-y-2">
              {OPTIONS.map(option => (
                <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
                  <input
                    type="radio"
                    name={`osdi-question-${index}`}
                    value={option.value}
                    checked={answers[index] === option.value}
                    onChange={() => chooseAnswer(index, option.value)}
                    className="mt-1 accent-teal"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}

              {index >= 5 && (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
                  <input
                    type="radio"
                    name={`osdi-question-${index}`}
                    value="-1"
                    checked={answers[index] === -1}
                    onChange={() => chooseAnswer(index, -1)}
                    className="mt-1 accent-slate-500"
                  />
                  <span className="text-sm text-slate-500">N/A — not applicable</span>
                </label>
              )}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        OSDI = (sum of scored answers × 100) ÷ (number of scored answers × 4).
        N/A responses are excluded from the numerator and denominator.
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </p>
      )}
    </AssessmentLayout>
  );
}
