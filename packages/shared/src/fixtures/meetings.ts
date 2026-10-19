import type { Meeting } from '../schemas.ts'

/** Interviews of two fixture candidates in the interview stage, linked to their invite emails. */
export const meetings: Meeting[] = [
  {
    id: 1,
    candidateId: 1,
    startsAt: '2026-09-10T08:00:00.000Z',
    durationMin: 60,
    jitsiUrl: 'https://meet.jit.si/hrmit-demo-amelia',
    emailId: 1,
  },
  {
    id: 2,
    candidateId: 7,
    startsAt: '2026-09-12T11:00:00.000Z',
    durationMin: 45,
    jitsiUrl: 'https://meet.jit.si/hrmit-demo-beatrice',
    emailId: 3,
  },
]
