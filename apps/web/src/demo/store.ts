import {
  AI_SETTINGS_DEFAULTS,
  SMTP_SETTINGS_DEFAULTS,
  fixtures,
  type AiSettingsView,
  type Candidate,
  type Email,
  type EmailTemplate,
  type Employee,
  type EmployeeNote,
  type Evaluation,
  type InterviewQuestion,
  type Job,
  type Meeting,
  type SmtpSettingsView,
  type TeamMemberLink,
  type TeamRow,
} from '@hrmit/shared'
import { DEMO_STORAGE_KEY } from '../config.ts'

/** Settings hold the view shapes only: no key or password is ever written to localStorage. */
type Store = {
  jobs: Job[]
  candidates: Candidate[]
  questions: InterviewQuestion[]
  evaluations: (Evaluation & { candidateId: number })[]
  aiSettings: AiSettingsView
  smtpSettings: SmtpSettingsView
  templates: EmailTemplate[]
  emails: Email[]
  meetings: Meeting[]
  employees: Employee[]
  employeeNotes: EmployeeNote[]
  teams: TeamRow[]
  teamMembers: TeamMemberLink[]
}

/** A fictional sender, so {{companyName}} renders in the demo send dialog. */
const DEMO_SMTP: SmtpSettingsView = {
  ...SMTP_SETTINGS_DEFAULTS,
  host: 'smtp.northwind.example',
  user: 'recruiting',
  from: 'recruiting@northwind.example',
  companyName: 'Northwind Scheduling',
  hasPass: true,
}

const seedEvaluations = () =>
  Object.entries(fixtures.evaluations).flatMap(([candidateId, list]) =>
    list.map((e) => ({ candidateId: Number(candidateId), ...e })),
  )

function load(): Store {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY)
    // Stores saved before a key existed get its default; jobs saved before 0.3.0 get teamId null.
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Store>
      return {
        aiSettings: AI_SETTINGS_DEFAULTS,
        questions: structuredClone(fixtures.questionRows),
        evaluations: seedEvaluations(),
        smtpSettings: DEMO_SMTP,
        templates: structuredClone(fixtures.emailTemplates),
        emails: structuredClone(fixtures.emails),
        meetings: structuredClone(fixtures.meetings),
        employees: structuredClone(fixtures.employees),
        teams: structuredClone(fixtures.teams),
        teamMembers: structuredClone(fixtures.teamMembers),
        ...saved,
        jobs: (saved.jobs ?? []).map((j) => ({ ...j, teamId: j.teamId ?? null })),
        // Notes saved before 0.3.2 have no title.
        employeeNotes: (saved.employeeNotes ?? fixtures.employeeNotes).map((n) => ({
          ...n,
          title: n.title ?? null,
        })),
      } as Store
    }
  } catch {
    // private mode, quota, corrupt JSON: fall through to fixtures
  }
  return {
    jobs: structuredClone(fixtures.jobs),
    candidates: structuredClone(fixtures.candidates),
    questions: structuredClone(fixtures.questionRows),
    evaluations: seedEvaluations(),
    aiSettings: AI_SETTINGS_DEFAULTS,
    smtpSettings: DEMO_SMTP,
    templates: structuredClone(fixtures.emailTemplates),
    emails: structuredClone(fixtures.emails),
    meetings: structuredClone(fixtures.meetings),
    employees: structuredClone(fixtures.employees),
    employeeNotes: structuredClone(fixtures.employeeNotes),
    teams: structuredClone(fixtures.teams),
    teamMembers: structuredClone(fixtures.teamMembers),
  }
}

/** In-memory demo state, seeded from fixtures, persisted after every mutation. */
export const store = load()
save()

export function save() {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // storage unavailable: the demo still works for this page load
  }
}
