import type { Meeting } from '../schemas.ts'
import { daysFromNow } from './dates.ts'

/**
 * Interviews of two fixture candidates in the interview stage, linked to their invite emails.
 * Relative dates (tomorrow 10:00, in three days 13:00) so the demo dashboard shows them.
 */
export const meetings: Meeting[] = [
  {
    id: 1,
    candidateId: 1,
    startsAt: daysFromNow(1, 10),
    durationMin: 60,
    jitsiUrl: 'https://meet.jit.si/hrmit-demo-amelia',
    emailId: 1,
  },
  {
    id: 2,
    candidateId: 7,
    startsAt: daysFromNow(3, 13),
    durationMin: 45,
    jitsiUrl: 'https://meet.jit.si/hrmit-demo-beatrice',
    emailId: 3,
  },
]
