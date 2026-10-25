import { PIPELINE_STAGES, type Candidate, type PipelineStage } from '@hrmit/shared'
import { Pencil, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Button } from '@/components/ui/button.tsx'
import { Switch } from '@/components/ui/switch.tsx'
import { APP_ROOT } from '@/config.ts'
import { cn } from '@/lib/utils.ts'
import { AiSection } from '../ai/AiSection.tsx'
import { RequirementsMatch } from '../ai/RequirementsMatch.tsx'
import { useScreen } from '../chat/ChatState.tsx'
import { EmailSection } from '../email/EmailSection.tsx'
import { MeetingsSection } from '../meetings/MeetingsSection.tsx'
import { NotesSection } from '../notes/NotesSection.tsx'
import { BlindContext, useBlindSetting } from './BlindContext.ts'
import { CandidateForm } from './CandidateForm.tsx'
import { candidateName } from './candidateName.ts'
import { CvSection } from './CvSection.tsx'
import { InterviewSummary } from './InterviewSummary.tsx'
import { Scorecard } from './Scorecard.tsx'
import { StageBadge } from '../pipeline/StageBadge.tsx'

/**
 * The candidate's own page (0.6.2), replacing the drawer: an overview that reads like a
 * dashboard, and the scorecard to fill in under its own tab.
 */
export function CandidatePage() {
  const { t, i18n } = useTranslation()
  const { id = '', candidateId = '' } = useParams()
  const navigate = useNavigate()
  const [blind, toggleBlind] = useBlindSetting()
  const [tab, setTab] = useState<'overview' | 'interview'>('overview')
  const [editing, setEditing] = useState(false)
  const [failed, setFailed] = useState<'move' | 'delete' | null>(null)
  // Bumped after an invite goes out: remounts the email history so the new row shows up.
  const [emailsKey, setEmailsKey] = useState(0)
  useScreen({ view: 'candidate', id: Number(candidateId) })
  const recruitment = `${APP_ROOT}/recruitments/${id}`

  const candidate = useApi(
    () =>
      api.api.candidates[':id'].$get({ param: { id: candidateId } }).then((r) => {
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
    [candidateId],
  )
  // ponytail: no GET /jobs/:id yet, same as the recruitment page.
  const job = useApi(
    () =>
      api.api.jobs
        .$get({ query: {} })
        .then((r) => r.json())
        .then((jobs) => jobs.find((j) => String(j.id) === id)),
    [id],
  )
  const replace = (c: Candidate) => candidate.setData(() => c)

  const move = async (c: Candidate, stage: PipelineStage) => {
    const res = await api.api.candidates[':id'].stage.$patch({
      param: { id: String(c.id) },
      json: { stage },
    })
    if (res.status !== 200) return setFailed('move')
    setFailed(null)
    replace(await res.json())
  }
  // Native confirm(): one line, keyboard accessible, no extra component.
  const remove = async (c: Candidate) => {
    if (!window.confirm(t('candidates.deleteConfirm', { name: candidateName(c, blind, t) }))) return
    const res = await api.api.candidates[':id'].$delete({ param: { id: String(c.id) } })
    if (res.status !== 204) return setFailed('delete')
    navigate(recruitment)
  }

  if (candidate.error || job.error) return <p className="text-destructive">{t('common.error')}</p>
  const c = candidate.data
  if (!c || !job.data) return <p className="text-muted-foreground">{t('common.loading')}</p>
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language)
  const hidden = <span className="text-muted-foreground italic">{t('candidates.hidden')}</span>

  return (
    <BlindContext value={blind}>
      <Link to={recruitment} className="text-sm text-primary hover:underline">
        ← {job.data.title}
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
          {candidateName(c, blind, t)}
          <StageBadge stage={c.stage} className="h-6 text-sm" />
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={blind} onCheckedChange={toggleBlind} />
            {t('candidates.blind')}
          </label>
          <select
            aria-label={t('candidates.moveTo')}
            value={c.stage}
            onChange={(e) => move(c, e.target.value as PipelineStage)}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {t(`stage.${s}`)}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil data-icon="inline-start" /> {t('common.edit')}
          </Button>
          <Button variant="destructive" onClick={() => remove(c)}>
            <Trash2 data-icon="inline-start" /> {t('common.delete')}
          </Button>
        </div>
      </div>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t(failed === 'move' ? 'candidates.moveFailed' : 'candidates.deleteFailed')}
        </p>
      )}

      <div role="tablist" className="mt-4 flex gap-1 border-b">
        {(['overview', 'interview'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            type="button"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={cn(
              '-mb-px border-b-2 px-3 py-1.5 text-sm font-medium',
              tab === v
                ? 'border-brand text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`candidatePage.${v}`)}
          </button>
        ))}
      </div>

      {tab === 'interview' ? (
        <div className="mt-4 max-w-3xl">
          <Scorecard candidate={c} onOpenGuide={() => navigate(`${recruitment}?view=guide`)} />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="grid content-start gap-4 lg:col-span-2">
            <Card title={t('match.title')}>
              <RequirementsMatch candidate={c} job={job.data} onChange={replace} />
            </Card>
            <Card title={t('candidatePage.interview')}>
              <InterviewSummary candidate={c} onOpenInterview={() => setTab('interview')} />
            </Card>
            <Card title={t('ai.title')}>
              <AiSection candidate={c} onChange={replace} />
            </Card>
            <Card>
              <NotesSection key={c.id} target="candidate" id={c.id} />
            </Card>
          </div>
          <div className="grid content-start gap-4">
            <Card title={t('candidatePage.contact')}>
              <dl className="grid gap-2 text-sm">
                <Field label={t('candidates.email')}>
                  {blind ? hidden : <a href={`mailto:${c.email}`}>{c.email}</a>}
                </Field>
                <Field label={t('candidates.phone')}>{blind ? hidden : c.phone || '–'}</Field>
                <Field label={t('candidates.stageChanged')}>{date(c.stageChangedAt)}</Field>
                <Field label={t('candidates.applied')}>{date(c.createdAt)}</Field>
              </dl>
            </Card>
            <Card title={t('cv.title')}>
              <CvSection candidate={c} onUploaded={replace} />
            </Card>
            <Card title={t('meetings.title')}>
              <MeetingsSection candidate={c} onScheduled={() => setEmailsKey((k) => k + 1)} />
            </Card>
            <Card title={t('email.title')}>
              <EmailSection key={emailsKey} candidate={c} />
            </Card>
          </div>
        </div>
      )}

      <CandidateForm
        key={editing ? 'open' : 'closed'}
        jobId={c.jobId}
        candidate={c}
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setEditing(false)
          replace(saved)
        }}
      />
    </BlindContext>
  )
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      {title && <h3 className="mb-3 font-medium">{title}</h3>}
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  )
}
