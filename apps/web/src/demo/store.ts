import {
  AI_SETTINGS_DEFAULTS,
  SMTP_SETTINGS_DEFAULTS,
  fixtures,
  type AiSettingsView,
  type Candidate,
  type Email,
  type EmailTemplate,
  type Evaluation,
  type InterviewQuestion,
  type Job,
  type SmtpSettingsView,
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
}

const seedEvaluations = () =>
  Object.entries(fixtures.evaluations).flatMap(([candidateId, list]) =>
    list.map((e) => ({ candidateId: Number(candidateId), ...e })),
  )

function load(): Store {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY)
    // Stores saved before a key existed get its default.
    if (raw)
      return {
        aiSettings: AI_SETTINGS_DEFAULTS,
        questions: structuredClone(fixtures.questionRows),
        evaluations: seedEvaluations(),
        smtpSettings: SMTP_SETTINGS_DEFAULTS,
        templates: structuredClone(fixtures.emailTemplates),
        emails: structuredClone(fixtures.emails),
        ...(JSON.parse(raw) as Partial<Store>),
      } as Store
  } catch {
    // private mode, quota, corrupt JSON: fall through to fixtures
  }
  return {
    jobs: structuredClone(fixtures.jobs),
    candidates: structuredClone(fixtures.candidates),
    questions: structuredClone(fixtures.questionRows),
    evaluations: seedEvaluations(),
    aiSettings: AI_SETTINGS_DEFAULTS,
    smtpSettings: SMTP_SETTINGS_DEFAULTS,
    templates: structuredClone(fixtures.emailTemplates),
    emails: structuredClone(fixtures.emails),
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
