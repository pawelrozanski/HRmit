import {
  AI_SETTINGS_DEFAULTS,
  fixtures,
  type AiSettingsView,
  type Candidate,
  type Job,
} from '@hrmit/shared'
import { DEMO_STORAGE_KEY } from '../config.ts'

/** aiSettings holds the view shape only: no key is ever written to localStorage. */
type Store = { jobs: Job[]; candidates: Candidate[]; aiSettings: AiSettingsView }

function load(): Store {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY)
    // Stores saved before a key existed get its default.
    if (raw)
      return { aiSettings: AI_SETTINGS_DEFAULTS, ...(JSON.parse(raw) as Partial<Store>) } as Store
  } catch {
    // private mode, quota, corrupt JSON: fall through to fixtures
  }
  return {
    jobs: structuredClone(fixtures.jobs),
    candidates: structuredClone(fixtures.candidates),
    aiSettings: AI_SETTINGS_DEFAULTS,
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
