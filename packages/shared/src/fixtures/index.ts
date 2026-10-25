import type { Candidate, CandidateNote, Job } from '../schemas.ts'
import { daysFromNow } from './dates.ts'

export { daysFromNow } from './dates.ts'

export { ai } from './ai/index.ts'
export { questions } from './questions.ts'
export { evaluations, questionRows } from './evaluations.ts'
export { emailTemplates, emails } from './emails.ts'
export { meetings } from './meetings.ts'
export { employeeNotes, employees, teamMembers, teams } from './teams.ts'

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
    teamId: 2,
    level: 'mid',
    location: 'Warsaw, hybrid (2 days in the office) or remote within the EU',
    contract: 'B2B (net) or employment contract (gross)',
    requirements:
      'At least 2 years of commercial work with React\nTypeScript in everyday use\nSemantic HTML and WCAG basics\nWritten English for code reviews',
    niceToHave: 'Testing Library or Playwright\nTailwind CSS\nExperience with an HR or B2B product',
    salaryMin: 14000,
    salaryMax: 19000,
    salaryCurrency: 'PLN',
    salaryPeriod: 'month',
    createdAt: T,
  },
  {
    id: 2,
    title: 'HR Business Partner',
    description:
      'Partner with two engineering teams on hiring plans, onboarding and development paths. Own the structured interview process and coach hiring managers on bias-aware interviewing.',
    status: 'open',
    teamId: null,
    level: 'senior',
    location: 'Warsaw, office first',
    contract: 'Employment contract (gross)',
    requirements:
      'At least 5 years in HR, 2 of them as a business partner\nRunning structured interviews\nFluent Polish and English',
    niceToHave: 'Experience with engineering teams\nLabour law training',
    salaryMin: 16000,
    salaryMax: 21000,
    salaryCurrency: 'PLN',
    salaryPeriod: 'month',
    createdAt: T,
  },
  {
    id: 3,
    title: 'Customer Support Specialist',
    description:
      'First line of contact for customers of a B2B scheduling tool. Written English and Polish, patience, and the habit of turning repeated questions into help-center articles.',
    status: 'closed',
    teamId: 3,
    level: 'junior',
    location: 'Remote within Poland',
    contract: 'Employment contract (gross)',
    requirements: 'Written English and Polish\nPatience with repeated questions',
    niceToHave: 'A help-center tool such as Zendesk or Intercom',
    salaryMin: 6500,
    salaryMax: 8000,
    salaryCurrency: 'PLN',
    salaryPeriod: 'month',
    createdAt: T,
  },
  {
    id: 4,
    title: 'Content Marketing Specialist',
    description:
      'Write and plan the blog, help center and product announcements of a B2B scheduling tool. Clear English, an eye for what customers actually search for, comfortable with analytics and a small budget.',
    status: 'open',
    teamId: 4,
    level: 'mid',
    location: 'Krakow, hybrid',
    contract: 'Employment contract (gross)',
    requirements: 'Clear written English\nA portfolio of published articles\nBasic web analytics',
    niceToHave: 'SEO keyword research\nB2B SaaS experience',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'PLN',
    salaryPeriod: 'month',
    createdAt: T,
  },
]

type Seed = [
  jobId: number,
  firstName: string,
  lastName: string,
  stage: Candidate['stage'],
  notes: string,
  /** Days since the last stage change; two of them wait long enough to show on the dashboard. */
  daysInStage: number,
]

const seeds: Seed[] = [
  [1, 'Amelia', 'Hartwell', 'interview', 'Portfolio shows a strong eye for accessible forms.', 3],
  [1, 'Theo', 'Blackwood', 'screening', 'Three years with React, asked about remote setup.', 9],
  [1, 'Priya', 'Lennox', 'applied', '', 1],
  [1, 'Marcus', 'Fairbanks', 'offer', 'Offer sent last week, awaiting answer.', 5],
  [1, 'Ingrid', 'Solberg', 'rejected', 'Looking for a backend-heavy role.', 6],
  [1, 'Oliver', 'Penhaligon', 'applied', '', 2],
  [2, 'Beatrice', 'Ashcombe', 'interview', 'Ran structured interviews at a previous company.', 4],
  [2, 'Samuel', 'Okonkwo', 'screening', '', 12],
  [2, 'Harriet', 'Vance', 'applied', '', 2],
  [2, 'Dmitri', 'Kovalenko', 'rejected', 'Salary expectations above the range.', 8],
  [2, 'Clara', 'Whitmore', 'applied', 'Referred by the engineering manager.', 1],
  [3, 'Jonah', 'Redfern', 'offer', '', 20],
  [3, 'Elise', 'Marchetti', 'interview', 'Bilingual, support experience in SaaS.', 25],
  [3, 'Rowan', 'Castellanos', 'screening', '', 30],
  [3, 'Felix', 'Brandt', 'applied', '', 33],
]

export const candidates: Candidate[] = seeds.map(
  ([jobId, firstName, lastName, stage, , daysInStage], i) => ({
    id: i + 1,
    jobId,
    firstName,
    lastName,
    email: `${firstName}.${lastName}@example.com`.toLowerCase(),
    phone: `+48 600 000 ${String(100 + i).padStart(3, '0')}`,
    stage,
    stageChangedAt: daysFromNow(-daysInStage),
    notes: '',
    cvFilename: null,
    cvText: null,
    aiSummaryJson: null,
    createdAt: T,
  }),
)

/** One dated note per candidate whose seed has one (0.6.0); ids follow the candidate order. */
export const candidateNotes: CandidateNote[] = seeds.flatMap(([, , , , notes], i) =>
  notes
    ? [
        {
          id: i + 1,
          candidateId: i + 1,
          title: null,
          body: notes,
          source: 'human' as const,
          createdAt: T,
        },
      ]
    : [],
)

/** Demo uploads ignore the file and attach this text instead (docs/ARCHITECTURE.md §4.2). */
export const cvText = `Frontend developer with four years of experience building accessible web applications in React and TypeScript.

Experience
2022 - present: Frontend Developer, Northwind Scheduling (fictional). Owned the booking calendar, introduced component tests, cut bundle size by a third.
2020 - 2022: Junior Developer, Larkspur Digital (fictional). Marketing sites, design-system work, accessibility audits.

Education
BSc Computer Science, 2020.

Skills
React, TypeScript, testing, accessibility (WCAG 2.1), Polish and English.`

/** What the demo's "Import from CV" returns, whichever file is dropped. Fictional. */
export const cvImport = {
  firstName: 'Nadia',
  lastName: 'Okafor',
  email: 'nadia.okafor@example.com',
  phone: '+48 600 000 199',
}
