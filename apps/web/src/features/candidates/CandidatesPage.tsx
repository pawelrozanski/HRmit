import type { Candidate, PipelineStage } from '@hrmit/shared'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Button } from '@/components/ui/button.tsx'
import { APP_ROOT } from '@/config.ts'
import { cn } from '@/lib/utils.ts'
import { Switch } from '@/components/ui/switch.tsx'
import { InterviewGuide } from '../recruitments/InterviewGuide.tsx'
import { JobDetails } from '../recruitments/JobDetails.tsx'
import { RecruitmentForm } from '../recruitments/RecruitmentForm.tsx'
import { KanbanBoard } from '../pipeline/KanbanBoard.tsx'
import { useScreen } from '../chat/ChatState.tsx'
import { BlindContext, useBlindSetting } from './BlindContext.ts'
import { CandidateForm } from './CandidateForm.tsx'

export function CandidatesPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const [blind, toggleBlind] = useBlindSetting()
  const navigate = useNavigate()
  // ?view=guide opens a tab (the scorecard links to the guide); ?candidate=ID is the pre-0.6.2
  // drawer link, now the candidate's page.
  const [params] = useSearchParams()
  const openId = params.get('candidate')
  const [moveError, setMoveError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState<'pipeline' | 'guide' | 'job'>(() =>
    params.get('view') === 'guide' ? 'guide' : params.get('view') === 'job' ? 'job' : 'pipeline',
  )
  const [editingJob, setEditingJob] = useState(false)
  const teams = useApi(() => api.api.teams.$get().then((r) => r.json()), [])
  useScreen({ view: 'recruitment', id: Number(id) })

  // ponytail: no GET /jobs/:id yet; the list is three rows. Add the route when jobs grow.
  const job = useApi(
    () =>
      api.api.jobs
        .$get({ query: {} })
        .then((r) => r.json())
        .then((jobs) => jobs.find((j) => String(j.id) === id)),
    [id],
  )
  const candidates = useApi(
    () =>
      api.api.jobs[':id'].candidates.$get({ param: { id }, query: {} }).then((r) => {
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
    [id],
  )
  const move = async (candidate: Candidate, stage: PipelineStage) => {
    const res = await api.api.candidates[':id'].stage.$patch({
      param: { id: String(candidate.id) },
      json: { stage },
    })
    if (res.status !== 200) return setMoveError(true)
    const moved = await res.json()
    setMoveError(false)
    replace(moved)
  }

  const replace = (c: Candidate) =>
    candidates.setData((list) => list.map((x) => (x.id === c.id ? c : x)))
  const created = (c: Candidate) => {
    candidates.setData((list) => [...list, c])
    setCreating(false)
  }

  if (openId) return <Navigate to={`candidates/${openId}`} replace />
  if (job.error || candidates.error) return <p className="text-destructive">{t('common.error')}</p>

  return (
    <BlindContext value={blind}>
      <Link to=".." className="text-sm text-primary hover:underline">
        ← {t('common.back')}
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{job.data?.title ?? t('common.loading')}</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={blind} onCheckedChange={toggleBlind} />
            {t('candidates.blind')}
          </label>
          <Button onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" /> {t('candidates.new')}
          </Button>
        </div>
      </div>
      {blind && <p className="mt-1 text-xs text-muted-foreground">{t('candidates.blindHint')}</p>}
      {moveError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t('candidates.moveFailed')}
        </p>
      )}

      <div role="tablist" className="mt-4 flex gap-1 border-b">
        {(['pipeline', 'guide', 'job'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            type="button"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              '-mb-px border-b-2 px-3 py-1.5 text-sm font-medium',
              view === v
                ? 'border-brand text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`candidates.${v}`)}
          </button>
        ))}
      </div>
      {view === 'guide' ? (
        <div className="mt-4">
          <InterviewGuide jobId={Number(id)} />
        </div>
      ) : view === 'job' ? (
        job.data && (
          <div className="mt-4">
            <JobDetails
              job={job.data}
              teamName={teams.data?.find((x) => x.id === job.data?.teamId)?.name}
              onEdit={() => setEditingJob(true)}
            />
          </div>
        )
      ) : !candidates.data ? (
        <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <div className="mt-4">
          <KanbanBoard
            candidates={candidates.data}
            onOpen={(c) => navigate(`${APP_ROOT}/recruitments/${id}/candidates/${c.id}`)}
            onMove={move}
          />
        </div>
      )}

      {job.data && (
        <RecruitmentForm
          key={editingJob ? 'open' : 'closed'}
          job={job.data}
          teams={teams.data ?? []}
          open={editingJob}
          onClose={() => setEditingJob(false)}
          onSaved={(saved) => {
            job.setData(() => saved)
            setEditingJob(false)
          }}
        />
      )}
      <CandidateForm
        key={creating ? 'open' : 'closed'}
        jobId={Number(id)}
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={created}
      />
    </BlindContext>
  )
}
