import type { Email, EmailTemplate } from '../schemas.ts'
import { daysFromNow } from './dates.ts'

/** Seeded into email_templates on first run and into the demo store. Plain text, editable. */
export const emailTemplates: EmailTemplate[] = [
  {
    key: 'invite',
    subject: 'Interview invitation: {{jobTitle}} at {{companyName}}',
    body: `Hello {{firstName}},

Thank you for applying for the {{jobTitle}} position at {{companyName}}. We would like to invite you to an online interview.

When: {{startsAt}}
Where: {{jitsiUrl}}

The interview follows the same structure for every candidate. If the time does not suit you, reply to this email and we will find another slot.

Kind regards,
{{companyName}} recruitment team`,
  },
  {
    key: 'reminder',
    subject: 'Reminder: your interview for {{jobTitle}}',
    body: `Hello {{firstName}},

A short reminder about your interview for the {{jobTitle}} position at {{companyName}}.

When: {{startsAt}}
Where: {{jitsiUrl}}

See you soon,
{{companyName}} recruitment team`,
  },
  {
    key: 'rejection',
    subject: 'Your application for {{jobTitle}}',
    body: `Hello {{firstName}},

Thank you for the time you invested in applying for the {{jobTitle}} position at {{companyName}}. After careful consideration we have decided to continue with other candidates.

We appreciate your interest and wish you every success in your search.

Kind regards,
{{companyName}} recruitment team`,
  },
]

const COMPANY = 'Northwind Scheduling'
const sign = `\n\nKind regards,\n${COMPANY} recruitment team`

/** Communication history of three fixture candidates. Fictional, never sent anywhere. */
export const emails: Email[] = [
  {
    id: 1,
    candidateId: 1,
    templateKey: 'invite',
    subject: `Interview invitation: Frontend Developer (React) at ${COMPANY}`,
    body: `Hello Amelia,\n\nThank you for applying for the Frontend Developer (React) position at ${COMPANY}. We would like to invite you to an online interview.\n\nWhen: 2026-09-10 10:00\nWhere: https://meet.jit.si/hrmit-demo-amelia${sign}`,
    status: 'sent',
    sentAt: '2026-09-03T08:15:00.000Z',
    error: null,
  },
  {
    id: 2,
    candidateId: 5,
    templateKey: 'rejection',
    subject: 'Your application for Frontend Developer (React)',
    body: `Hello Ingrid,\n\nThank you for the time you invested in applying for the Frontend Developer (React) position at ${COMPANY}. After careful consideration we have decided to continue with other candidates.${sign}`,
    status: 'sent',
    sentAt: '2026-09-05T14:02:00.000Z',
    error: null,
  },
  {
    id: 3,
    candidateId: 7,
    templateKey: 'invite',
    subject: `Interview invitation: HR Business Partner at ${COMPANY}`,
    body: `Hello Beatrice,\n\nThank you for applying for the HR Business Partner position at ${COMPANY}. We would like to invite you to an online interview.\n\nWhen: 2026-09-12 13:00\nWhere: https://meet.jit.si/hrmit-demo-beatrice${sign}`,
    status: 'sent',
    sentAt: '2026-09-04T09:30:00.000Z',
    error: null,
  },
  // One failed send two days ago, so the dashboard has something to point at.
  {
    id: 4,
    candidateId: 2,
    templateKey: 'reminder',
    subject: 'Reminder: your interview for Frontend Developer (React)',
    body: `Hello Theo,

A short reminder about your interview for the Frontend Developer (React) position at ${COMPANY}.${sign}`,
    status: 'failed',
    sentAt: daysFromNow(-2),
    error: 'Connection refused by smtp.northwind.example:587',
  },
]
