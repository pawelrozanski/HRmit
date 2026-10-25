import type { Employee, EmployeeNote, TeamMemberLink, TeamRow } from '../schemas.ts'

/**
 * The hiring side of the demo: teams and the employees in them. Everyone is invented and every
 * address is under example.com. Seeds the local database on first run and the demo store.
 */
const T = '2026-09-01T09:00:00.000Z'

export const teams: TeamRow[] = [
  {
    id: 1,
    name: 'Sales',
    description: 'New business and renewals for the EU market.',
    createdAt: T,
  },
  {
    id: 2,
    name: 'IT',
    description: 'Product engineering: web, backend and infrastructure.',
    createdAt: T,
  },
  {
    id: 3,
    name: 'Customer Support',
    description: 'First and second line for all customers, in English and Polish.',
    createdAt: T,
  },
  { id: 4, name: 'Marketing', description: 'Content, website and product launches.', createdAt: T },
]

type Seed = [
  firstName: string,
  lastName: string,
  position: string,
  hiredAt: string | null,
  duties: string,
]

const seeds: Seed[] = [
  [
    'Margaret',
    'Linwood',
    'Head of Sales',
    '2021-03-01',
    'Owns the EU pipeline and quarterly targets.\nRuns weekly forecast reviews.\nFinal interview for every sales hire.',
  ],
  [
    'Tobias',
    'Renner',
    'Account Executive',
    '2023-06-12',
    'Closes mid-market deals.\nHands over signed customers to Support.',
  ],
  [
    'Yusuf',
    'Adeyemi',
    'Sales Development Representative',
    '2025-01-20',
    'Qualifies inbound leads.\nBooks discovery calls for the account executives.',
  ],
  [
    'Hanna',
    'Sorlie',
    'Engineering Manager',
    '2020-09-14',
    'Leads the web and backend teams.\nHiring manager for engineering roles.\nRuns structured interview training.',
  ],
  [
    'Kacper',
    'Zielinski',
    'Senior Frontend Developer',
    '2022-02-07',
    'Owns the recruiter-facing panel.\nReviews frontend take-home tasks.\nPairs with new joiners for their first month.',
  ],
  [
    'Leila',
    'Haddad',
    'Backend Developer',
    '2023-11-02',
    'API and database work.\nOn the interview panel for backend roles.',
  ],
  [
    'Gregor',
    'Pavlenko',
    'Site Reliability Engineer',
    '2024-04-15',
    'Runs the deployment pipeline and the on-call rotation.',
  ],
  [
    'Agnieszka',
    'Dabrowska',
    'Support Team Lead',
    '2021-08-23',
    'Leads first and second line support.\nHiring manager for support roles.\nOwns the help-center backlog.',
  ],
  [
    'Niall',
    'Brennan',
    'Support Specialist',
    '2024-02-19',
    'First line in English.\nWrites help-center articles from repeated tickets.',
  ],
  [
    'Zofia',
    'Mazur',
    'Support Specialist',
    null,
    'First line in Polish and English.\nEscalates product bugs to engineering.',
  ],
  [
    'Elena',
    'Castellanos',
    'Head of Marketing',
    '2022-10-10',
    'Owns the content calendar and the website.\nHiring manager for marketing roles.\nWorks with Sales on launch messaging.',
  ],
  [
    'Rafael',
    'Nunes',
    'Product Marketing Manager',
    '2024-09-02',
    'Writes launch announcements and release notes.\nBriefs Sales and Support before every launch.',
  ],
]

export const employees: Employee[] = seeds.map(
  ([firstName, lastName, position, hiredAt, duties], i) => ({
    id: i + 1,
    firstName,
    lastName,
    position,
    email: `${firstName}.${lastName}@example.com`.toLowerCase(),
    hiredAt,
    duties,
    createdAt: T,
  }),
)

/** One lead per team; Hanna (IT, Support) and Rafael (Marketing, Sales) sit in two teams. */
export const teamMembers: TeamMemberLink[] = [
  { teamId: 1, employeeId: 1, role: 'lead' },
  { teamId: 1, employeeId: 2, role: 'member' },
  { teamId: 1, employeeId: 3, role: 'member' },
  { teamId: 1, employeeId: 12, role: 'member' },
  { teamId: 2, employeeId: 4, role: 'lead' },
  { teamId: 2, employeeId: 5, role: 'member' },
  { teamId: 2, employeeId: 6, role: 'member' },
  { teamId: 2, employeeId: 7, role: 'member' },
  { teamId: 3, employeeId: 8, role: 'lead' },
  { teamId: 3, employeeId: 9, role: 'member' },
  { teamId: 3, employeeId: 10, role: 'member' },
  { teamId: 3, employeeId: 4, role: 'member' },
  { teamId: 4, employeeId: 11, role: 'lead' },
  { teamId: 4, employeeId: 12, role: 'member' },
]

/** Short working notes on three employees, newest last. */
export const employeeNotes: EmployeeNote[] = [
  {
    id: 1,
    employeeId: 4,
    title: 'Q4 React interviews',
    body: 'Agreed to run the React interviews in Q4.',
    source: 'human',
    createdAt: '2026-09-03T10:15:00.000Z',
  },
  {
    id: 2,
    employeeId: 4,
    title: null,
    body: 'Prefers morning slots for panels.',
    source: 'human',
    createdAt: '2026-09-10T08:40:00.000Z',
  },
  {
    id: 3,
    employeeId: 4,
    title: 'Availability',
    body: 'Out of office 20-24 October.',
    source: 'human',
    createdAt: '2026-09-28T14:05:00.000Z',
  },
  {
    id: 4,
    employeeId: 8,
    title: 'Panel preferences',
    body: 'Wants a second interviewer on every support panel.',
    source: 'human',
    createdAt: '2026-09-05T11:30:00.000Z',
  },
  {
    id: 5,
    employeeId: 8,
    title: 'Languages',
    body: 'Can take Polish-language interviews.',
    source: 'human',
    createdAt: '2026-09-17T09:00:00.000Z',
  },
  {
    id: 6,
    employeeId: 11,
    title: 'Take-home brief',
    body: 'Asked for the marketing take-home brief to be shortened.',
    source: 'human',
    createdAt: '2026-09-12T15:20:00.000Z',
  },
]
