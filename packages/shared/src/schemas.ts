import { z } from 'zod'

/** Pipeline stages, in kanban order. The only place this list exists. */
export const PIPELINE_STAGES = ['applied', 'screening', 'interview', 'offer', 'rejected'] as const
export const pipelineStageSchema = z.enum(PIPELINE_STAGES)
export type PipelineStage = z.infer<typeof pipelineStageSchema>

export const healthSchema = z.object({
  ok: z.literal(true),
  mode: z.enum(['local', 'demo']),
  version: z.string(),
})
export type Health = z.infer<typeof healthSchema>

export const jobStatusSchema = z.enum(['open', 'closed'])

/**
 * A job is what the UI calls a "recruitment" (see the glossary in docs/ARCHITECTURE.md).
 * teamId is the hiring team, null when none is assigned.
 */
export const jobSchema = z.object({
  id: z.number().int(),
  title: z.string().min(1),
  description: z.string(),
  status: jobStatusSchema,
  teamId: z.number().int().nullable(),
  createdAt: z.string(),
})
export type Job = z.infer<typeof jobSchema>

/** Body of POST /api/jobs and PUT /api/jobs/:id. Closing a job is a PUT with status 'closed'. */
export const jobInputSchema = jobSchema.omit({ id: true, createdAt: true }).extend({
  description: z.string().default(''),
  status: jobStatusSchema.default('open'),
  teamId: z.number().int().nullable().default(null),
})
export type JobInput = z.input<typeof jobInputSchema>

/**
 * Employees are the hiring side (interviewers, hiring managers), never candidates. They are
 * personal data too: hard-deleted with their memberships, and never part of an AI prompt.
 */
export const employeeSchema = z.object({
  id: z.number().int(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  position: z.string().min(1),
  email: z.string().email(),
  /** ISO date (YYYY-MM-DD) or null when unknown. */
  hiredAt: z.iso.date().nullable(),
  /** Free text, one duty per line. */
  duties: z.string(),
  createdAt: z.string(),
})
export type Employee = z.infer<typeof employeeSchema>

/** Body of POST /api/employees and PUT /api/employees/:id. */
export const employeeInputSchema = employeeSchema.omit({ id: true, createdAt: true }).extend({
  hiredAt: z.iso.date().nullable().default(null),
  duties: z.string().default(''),
})
export type EmployeeInput = z.input<typeof employeeInputSchema>

export const TEAM_MEMBER_ROLES = ['member', 'lead'] as const
export const teamMemberRoleSchema = z.enum(TEAM_MEMBER_ROLES)
export type TeamMemberRole = z.infer<typeof teamMemberRoleSchema>

/** One membership row: an employee can be in several teams, with one role per team. */
export const teamMemberLinkSchema = z.object({
  teamId: z.number().int(),
  employeeId: z.number().int(),
  role: teamMemberRoleSchema,
})
export type TeamMemberLink = z.infer<typeof teamMemberLinkSchema>

/** GET /api/employees and /api/employees/:id: the employee with the teams they belong to. */
export const employeeWithTeamsSchema = employeeSchema.extend({
  teams: z.object({ id: z.number().int(), name: z.string(), role: teamMemberRoleSchema }).array(),
  noteCount: z.number().int(),
})
export type EmployeeWithTeams = z.infer<typeof employeeWithTeamsSchema>

/** A free-text note on an employee (plain text, never HTML). Deleted with the employee. */
export const employeeNoteSchema = z.object({
  id: z.number().int(),
  employeeId: z.number().int(),
  /** Null when blank; the UI shows an "Untitled note" placeholder then. */
  title: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
})
export type EmployeeNote = z.infer<typeof employeeNoteSchema>

/** Body of POST /api/employees/:id/notes. A blank title is stored as null. */
export const employeeNoteInputSchema = z.object({
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1).max(5000),
})
export type EmployeeNoteInput = z.input<typeof employeeNoteInputSchema>

/** A team as stored. Names are unique case-insensitively. */
export const teamRowSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  description: z.string(),
  createdAt: z.string(),
})
export type TeamRow = z.infer<typeof teamRowSchema>

/** GET /api/teams: each team with its counts. */
export const teamSchema = teamRowSchema.extend({
  memberCount: z.number().int(),
  openJobCount: z.number().int(),
})
export type Team = z.infer<typeof teamSchema>

/** Body of POST /api/teams and PUT /api/teams/:id. A duplicate name answers 409. */
export const teamInputSchema = teamRowSchema.omit({ id: true, createdAt: true }).extend({
  description: z.string().default(''),
})
export type TeamInput = z.input<typeof teamInputSchema>

/** GET /api/teams/:id and the answer of every membership change: members with role, jobs. */
export const teamDetailSchema = teamSchema.extend({
  members: employeeSchema.extend({ role: teamMemberRoleSchema }).array(),
  jobs: jobSchema.array(),
})
export type TeamDetail = z.infer<typeof teamDetailSchema>

/** Body of POST /api/teams/:id/members. Employees already in the team are ignored. */
export const addMembersSchema = z.object({ employeeIds: z.number().int().array().min(1) })

/** Body of PATCH /api/teams/:id/members/:employeeId. */
export const setMemberRoleSchema = z.object({ role: teamMemberRoleSchema })

/**
 * AI output schemas (ADR 0004): descriptive fields only. No score, rank, fit, recommendation,
 * verdict or flag field exists anywhere here; schemas.test.ts asserts it.
 */
export const cvSummarySchema = z.object({
  summary: z.string().describe('3 to 6 sentences describing the CV'),
  highlights: z.array(z.string()).describe('short factual points taken from the CV'),
})
export type CvSummary = z.infer<typeof cvSummarySchema>

export const competenciesSchema = z.object({
  competencies: z.array(
    z.object({
      name: z.string(),
      evidence: z.string().describe('where in the CV this competency shows'),
    }),
  ),
})
export type Competencies = z.infer<typeof competenciesSchema>

const aiMeta = z.object({ generatedAt: z.string(), model: z.string() })

/** Stored as candidate.aiSummaryJson: each action's last output plus when and by which model. */
export const aiSummarySchema = z.object({
  summary: cvSummarySchema.extend(aiMeta.shape).optional(),
  competencies: competenciesSchema.extend(aiMeta.shape).optional(),
})
export type AiSummary = z.infer<typeof aiSummarySchema>

/**
 * Structured interview (ADR 0004): questions belong to the job, never to a candidate, so every
 * applicant gets the same list. Descriptive fields only, like the other AI outputs.
 */
export const interviewQuestionSchema = z.object({
  id: z.number().int(),
  jobId: z.number().int(),
  competency: z.string().min(1),
  question: z.string().min(1),
  sortOrder: z.number().int(),
})
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>

/** One item of the PUT /api/jobs/:id/questions body: the server assigns id and sortOrder. */
export const interviewQuestionInputSchema = interviewQuestionSchema.pick({
  competency: true,
  question: true,
})
export type InterviewQuestionInput = z.infer<typeof interviewQuestionInputSchema>

/** Model output for POST /api/ai/questions/:jobId: 6 to 10 questions over 3 to 5 competencies. */
export const questionsGenerationSchema = z.object({
  questions: z
    .array(
      z.object({
        competency: z.string().describe('the competency this question explores'),
        question: z.string().describe('a behavioural question every candidate can be asked'),
      }),
    )
    .min(6)
    .max(10),
})
export type QuestionsGeneration = z.infer<typeof questionsGenerationSchema>

/** Response of POST /api/ai/questions/:jobId: applied when the job had no questions yet. */
export const questionsProposalSchema = z.object({
  questions: interviewQuestionInputSchema.array(),
  applied: z.boolean(),
})
export type QuestionsProposal = z.infer<typeof questionsProposalSchema>

/**
 * Scorecard (ADR 0004): a human interviewer's 1 to 5 score and note per question of the job.
 * score null means not scored yet. Shown per question and averaged per competency, never summed
 * into one number for the candidate.
 */
export const evaluationSchema = z.object({
  questionId: z.number().int(),
  score: z.number().int().min(1).max(5).nullable(),
  note: z.string(),
})
export type Evaluation = z.infer<typeof evaluationSchema>

/**
 * GET /api/candidates/:id/scorecard: every question of the candidate's job in guide order, joined
 * with its evaluation, so the UI always has the full list. PUT takes evaluationSchema.array().
 */
export const scorecardSchema = z.object({
  candidateId: z.number().int(),
  evaluations: evaluationSchema
    .extend(interviewQuestionSchema.pick({ competency: true, question: true }).shape)
    .array(),
})
export type Scorecard = z.infer<typeof scorecardSchema>

/** Body of POST /api/ai/summarize/:candidateId and /competencies/:candidateId. */
export const aiActionBodySchema = z.object({ lang: z.enum(['en', 'pl']) })
export type AiLang = z.infer<typeof aiActionBodySchema>['lang']

export const candidateSchema = z.object({
  id: z.number().int(),
  jobId: z.number().int(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string(),
  stage: pipelineStageSchema,
  stageChangedAt: z.string(),
  notes: z.string(),
  /** Original upload name, display only. The file itself is served by id, never by path. */
  cvFilename: z.string().nullable(),
  /** Plain text extracted from the CV; empty when extraction failed, null without a CV. */
  cvText: z.string().nullable(),
  aiSummaryJson: aiSummarySchema.nullable(),
  createdAt: z.string(),
})
export type Candidate = z.infer<typeof candidateSchema>

/** Body of POST /api/candidates and PUT /api/candidates/:id. CV fields change only via upload. */
export const candidateInputSchema = candidateSchema
  .omit({
    id: true,
    createdAt: true,
    stageChangedAt: true,
    cvFilename: true,
    cvText: true,
    aiSummaryJson: true,
  })
  .extend({
    phone: z.string().default(''),
    stage: pipelineStageSchema.default('applied'),
    notes: z.string().default(''),
  })
export type CandidateInput = z.input<typeof candidateInputSchema>

/** Body of PATCH /api/candidates/:id/stage. */
export const moveStageSchema = z.object({ stage: pipelineStageSchema })

/** AI provider settings. ADR 0005: Ollama on localhost by default, cloud providers are BYOK. */
export const aiProviderSchema = z.enum(['ollama', 'anthropic', 'openai-compatible'])
export type AiProvider = z.infer<typeof aiProviderSchema>

/** Body of PUT /api/settings/ai. apiKey omitted or '' keeps the stored key, null clears it. */
export const aiSettingsSchema = z.object({
  provider: aiProviderSchema,
  baseUrl: z.string().url(),
  model: z.string().min(1),
  apiKey: z.string().nullable().optional(),
})
export type AiSettings = z.infer<typeof aiSettingsSchema>

/** What GET /api/settings/ai returns: the key itself never leaves the server. */
export const aiSettingsViewSchema = aiSettingsSchema
  .omit({ apiKey: true })
  .extend({ hasApiKey: z.boolean() })
export type AiSettingsView = z.infer<typeof aiSettingsViewSchema>

export const AI_SETTINGS_DEFAULTS: AiSettingsView = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  model: 'qwen2.5:7b-instruct',
  hasApiKey: false,
}

/** Result of POST /api/ai/test. The error text is sanitized on the server: no key, no stack. */
export const aiTestResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), model: z.string(), latencyMs: z.number() }),
  z.object({ ok: z.literal(false), error: z.string() }),
])
export type AiTestResult = z.infer<typeof aiTestResultSchema>

/** GET /api/ai/preview/:candidateId: what a cloud provider would receive, next to the original. */
export const aiPreviewSchema = z.object({
  original: z.string(),
  anonymized: z.string(),
  replacements: z.array(z.object({ kind: z.string(), count: z.number().int() })),
  provider: z.enum(['local', 'cloud']),
})
export type AiPreview = z.infer<typeof aiPreviewSchema>

/** Email templates (docs/ARCHITECTURE.md §6): one editable text per key, placeholders in {{ }}. */
export const EMAIL_TEMPLATE_KEYS = ['invite', 'reminder', 'rejection'] as const
export const emailTemplateKeySchema = z.enum(EMAIL_TEMPLATE_KEYS)
export type EmailTemplateKey = z.infer<typeof emailTemplateKeySchema>

export const emailTemplateSchema = z.object({
  key: emailTemplateKeySchema,
  subject: z.string().min(1),
  body: z.string().min(1),
})
export type EmailTemplate = z.infer<typeof emailTemplateSchema>

/** Body of PUT /api/settings/smtp. pass omitted or '' keeps the stored one, null clears it. */
export const smtpSettingsSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string(),
  pass: z.string().nullable().optional(),
  from: z.string().email(),
  /** Sender display name and the {{companyName}} placeholder. */
  companyName: z.string().default(''),
})
export type SmtpSettings = z.infer<typeof smtpSettingsSchema>

/** What GET /api/settings/smtp returns: the password never leaves the server. Empty until set. */
export const smtpSettingsViewSchema = smtpSettingsSchema
  .omit({ pass: true })
  .extend({ host: z.string(), from: z.string(), hasPass: z.boolean() })
export type SmtpSettingsView = z.infer<typeof smtpSettingsViewSchema>

export const SMTP_SETTINGS_DEFAULTS: SmtpSettingsView = {
  host: '',
  port: 587,
  secure: false,
  user: '',
  from: '',
  companyName: '',
  hasPass: false,
}

/** Result of POST /api/settings/smtp/test. The error is sanitized: no password, no stack. */
export const smtpTestResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.string() }),
])
export type SmtpTestResult = z.infer<typeof smtpTestResultSchema>

/** One row of the candidate's communication history. 'demo' rows were never sent anywhere. */
export const emailSchema = z.object({
  id: z.number().int(),
  candidateId: z.number().int(),
  templateKey: emailTemplateKeySchema,
  subject: z.string(),
  body: z.string(),
  status: z.enum(['sent', 'failed', 'demo']),
  sentAt: z.string(),
  error: z.string().nullable(),
})
export type Email = z.infer<typeof emailSchema>

/** Body of POST /api/candidates/:id/emails: the final text, edited by the recruiter in the UI. */
export const sendEmailInputSchema = emailSchema.pick({
  templateKey: true,
  subject: true,
  body: true,
})
export type SendEmailInput = z.infer<typeof sendEmailInputSchema>

/** GET /api/candidates/:id/emails/preview?template=…: the rendered text the UI starts from. */
export const emailPreviewSchema = sendEmailInputSchema
export type EmailPreview = z.infer<typeof emailPreviewSchema>

/** Every generated room lives under this prefix; the schema rejects anything else. */
export const JITSI_PREFIX = 'https://meet.jit.si/hrmit-'

/** A scheduled interview (docs/ARCHITECTURE.md §6). emailId is the invite row, null once deleted. */
export const meetingSchema = z.object({
  id: z.number().int(),
  candidateId: z.number().int(),
  startsAt: z.iso.datetime(),
  durationMin: z.number().int().min(15).max(480),
  jitsiUrl: z.string().url().startsWith(JITSI_PREFIX),
  emailId: z.number().int().nullable(),
})
export type Meeting = z.infer<typeof meetingSchema>

/**
 * Body of POST /api/candidates/:id/meetings. jitsiUrl, subject and body come from the preview the
 * recruiter edited; when omitted the server generates a room and renders the invite template.
 */
export const meetingInputSchema = meetingSchema.pick({ startsAt: true, durationMin: true }).extend({
  jitsiUrl: meetingSchema.shape.jitsiUrl.optional(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
})
export type MeetingInput = z.infer<typeof meetingInputSchema>

/** GET /api/candidates/:id/meetings/preview?startsAt=…: the invite text the dialog starts from. */
export const meetingPreviewSchema = z.object({
  subject: z.string(),
  body: z.string(),
  jitsiUrl: meetingSchema.shape.jitsiUrl,
})
export type MeetingPreview = z.infer<typeof meetingPreviewSchema>

/** Answer of POST /api/candidates/:id/meetings: no meeting when the invite failed to send. */
export const meetingResultSchema = z.object({
  meeting: meetingSchema.nullable(),
  email: emailSchema,
})
export type MeetingResult = z.infer<typeof meetingResultSchema>

/** Prefill for the new-candidate form, parsed from an uploaded CV. Strings may be empty. */
export const cvContactSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
})
export type CvContact = z.infer<typeof cvContactSchema>

export const cvImportSchema = z.object({
  fields: cvContactSchema,
  cvText: z.string(),
  /** 'ai' = a local model read the CV; 'heuristic' = regex guess (no local model). */
  source: z.enum(['ai', 'heuristic']),
})
export type CvImport = z.infer<typeof cvImportSchema>
