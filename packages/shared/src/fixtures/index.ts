import type { Candidate, Job } from '../schemas.ts'

/**
 * Demo data. Every person and company here is invented; any resemblance to a real
 * person is accidental. Seeds the local SQLite on first run and the demo store.
 */
const T = '2026-09-01T09:00:00.000Z'

export const jobs: Job[] = [
  {
    id: 1,
    title: 'Frontend Developer (React)',
    description:
      'Build and maintain the recruiter-facing panel of a small HR product. React, TypeScript, accessibility and clean component design matter more than framework trivia. Hybrid, Warsaw or remote within the EU.',
    status: 'open',
    createdAt: T,
  },
  {
    id: 2,
    title: 'HR Business Partner',
    description:
      'Partner with two engineering teams on hiring plans, onboarding and development paths. Own the structured interview process and coach hiring managers on bias-aware interviewing.',
    status: 'open',
    createdAt: T,
  },
  {
    id: 3,
    title: 'Customer Support Specialist',
    description:
      'First line of contact for customers of a B2B scheduling tool. Written English and Polish, patience, and the habit of turning repeated questions into help-center articles.',
    status: 'closed',
    createdAt: T,
  },
]

type Seed = [
  jobId: number,
  firstName: string,
  lastName: string,
  stage: Candidate['stage'],
  notes: string,
]

const seeds: Seed[] = [
  [1, 'Amelia', 'Hartwell', 'interview', 'Portfolio shows a strong eye for accessible forms.'],
  [1, 'Theo', 'Blackwood', 'screening', 'Three years with React, asked about remote setup.'],
  [1, 'Priya', 'Lennox', 'applied', ''],
  [1, 'Marcus', 'Fairbanks', 'offer', 'Offer sent on 15 Sep, awaiting answer.'],
  [1, 'Ingrid', 'Solberg', 'rejected', 'Looking for a backend-heavy role.'],
  [1, 'Oliver', 'Penhaligon', 'applied', ''],
  [2, 'Beatrice', 'Ashcombe', 'interview', 'Ran structured interviews at a previous company.'],
  [2, 'Samuel', 'Okonkwo', 'screening', ''],
  [2, 'Harriet', 'Vance', 'applied', ''],
  [2, 'Dmitri', 'Kovalenko', 'rejected', 'Salary expectations above the range.'],
  [2, 'Clara', 'Whitmore', 'applied', 'Referred by the engineering manager.'],
  [3, 'Jonah', 'Redfern', 'offer', ''],
  [3, 'Elise', 'Marchetti', 'interview', 'Bilingual, support experience in SaaS.'],
  [3, 'Rowan', 'Castellanos', 'screening', ''],
  [3, 'Felix', 'Brandt', 'applied', ''],
]

export const candidates: Candidate[] = seeds.map(
  ([jobId, firstName, lastName, stage, notes], i) => ({
    id: i + 1,
    jobId,
    firstName,
    lastName,
    email: `${firstName}.${lastName}@example.com`.toLowerCase(),
    phone: `+48 600 000 ${String(100 + i).padStart(3, '0')}`,
    stage,
    stageChangedAt: T,
    notes,
    createdAt: T,
  }),
)
