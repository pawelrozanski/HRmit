import type { Evaluation } from '../schemas.ts'
import { questions } from './questions.ts'

/**
 * The fixture question sets as rows, ids counted across jobs in order like autoincrement.
 * Seeds the local database and the demo store, so both sides agree on question ids.
 */
export const questionRows = Object.entries(questions)
  .flatMap(([jobId, set]) => set.map((q, sortOrder) => ({ jobId: Number(jobId), sortOrder, ...q })))
  .map((q, i) => ({ id: i + 1, ...q }))

const questionId = (jobId: number, index: number) =>
  questionRows.find((q) => q.jobId === jobId && q.sortOrder === index)!.id

/** candidate id -> [job id, scores by question position, notes]. Scored by a fictional interviewer. */
const scored: Record<number, [jobId: number, scores: (number | null)[], notes: string[]]> = {
  // Amelia Hartwell, Frontend: fully scored.
  1: [
    1,
    [4, 5, 5, 4, 3, 4, 4, 3],
    [
      'Date picker reused by two teams; clear props, documented edge cases.',
      'Split a 900-line form by data flow, not by visual sections.',
      'Caught a focus trap bug with a screen reader before QA did.',
      'Pushed back on a modal without keyboard close; got it fixed.',
      'Sided with the designer without checking constraints first.',
      '',
      'Traced a race in a debounce; added a regression test.',
      'Started with the checkout path. Honest about coverage gaps.',
    ],
  ],
  // Marcus Fairbanks, Frontend: six of eight scored, so the averages show a partial count.
  4: [
    1,
    [5, 4, 3, null, 4, 5, null, 4],
    [
      'Table component with virtualization, used across the product.',
      '',
      'Knows the WCAG basics; testing was manual only.',
      '',
      'Gave a concrete example of changing his own proposal.',
      'Review on error boundaries changed how he structures pages.',
      '',
      'Introduced tests through CI gates on new files only. Pragmatic.',
    ],
  ],
  // Beatrice Ashcombe, HR Business Partner: four of seven scored.
  7: [
    2,
    [5, 4, null, 4, null, null, 3],
    [
      'Rebuilt the process around work samples; measured time-to-hire and offer acceptance.',
      'Piloted with one team first, shared the data, then rolled out.',
      '',
      'Named the bias in private, with the interview notes as evidence.',
      '',
      '',
      'Used attrition data but admitted it hid the reasons behind it.',
    ],
  ],
}

/** candidate id -> evaluations, with question ids that match questionRows. */
export const evaluations: Record<number, Evaluation[]> = Object.fromEntries(
  Object.entries(scored).map(([candidateId, [jobId, scores, notes]]) => [
    candidateId,
    scores.map((score, i) => ({ questionId: questionId(jobId, i), score, note: notes[i] ?? '' })),
  ]),
)
