import { fixtures, type Candidate, type Job } from '@hrmit/shared'
import { DEMO_STORAGE_KEY } from '../config.ts'

type Store = { jobs: Job[]; candidates: Candidate[] }

function load(): Store {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch {
    // private mode, quota, corrupt JSON: fall through to fixtures
  }
  return { jobs: structuredClone(fixtures.jobs), candidates: structuredClone(fixtures.candidates) }
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
