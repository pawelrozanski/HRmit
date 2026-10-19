import { PIPELINE_STAGES, type Candidate, type PipelineStage } from '@hrmit/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Switch } from '@/components/ui/switch.tsx'
import { BlindContext } from './BlindContext.ts'
import { CandidateDrawer } from './CandidateDrawer.tsx'
import { candidateName } from './candidateName.ts'

const BLIND_KEY = 'hrmit-blind'

export function CandidatesPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const [stage, setStage] = useState<PipelineStage | undefined>()
  const [blind, setBlind] = useState(() => localStorage.getItem(BLIND_KEY) === '1')
  const [selected, setSelected] = useState<Candidate | null>(null)

  // ponytail: no GET /jobs/:id yet; the list is three rows. Add the route when jobs grow.
  const job = useApi(
    () =>
      api.api.jobs
        .$get()
        .then((r) => r.json())
        .then((jobs) => jobs.find((j) => String(j.id) === id)),
    [id],
  )
  const candidates = useApi(
    () =>
      api.api.jobs[':id'].candidates
        .$get({ param: { id }, query: stage ? { stage } : {} })
        .then((r) => {
          if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
          return r.json()
        }),
    [id, stage],
  )

  const toggleBlind = (on: boolean) => {
    setBlind(on)
    localStorage.setItem(BLIND_KEY, on ? '1' : '0')
  }

  if (job.error || candidates.error) return <p className="text-destructive">{t('common.error')}</p>

  return (
    <BlindContext value={blind}>
      <Link to=".." className="text-sm text-brand-dark hover:underline">
        ← {t('common.back')}
      </Link>
      <h2 className="mt-2 text-xl font-semibold">{job.data?.title ?? t('common.loading')}</h2>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant={stage ? 'outline' : 'default'}
          size="sm"
          onClick={() => setStage(undefined)}
        >
          {t('candidates.allStages')}
        </Button>
        {PIPELINE_STAGES.map((s) => (
          <Button
            key={s}
            variant={stage === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStage(s)}
          >
            {t(`stage.${s}`)}
          </Button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <Switch checked={blind} onCheckedChange={toggleBlind} />
          {t('candidates.blind')}
        </label>
      </div>
      {blind && <p className="mt-1 text-xs text-muted-foreground">{t('candidates.blindHint')}</p>}

      {!candidates.data ? (
        <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
      ) : candidates.data.length === 0 ? (
        <p className="mt-4 text-muted-foreground">{t('candidates.empty')}</p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border bg-card">
          {candidates.data.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelected(c)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="font-medium">{candidateName(c, blind, t)}</span>
                <Badge variant="secondary">{t(`stage.${c.stage}`)}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      <CandidateDrawer candidate={selected} onClose={() => setSelected(null)} />
    </BlindContext>
  )
}
