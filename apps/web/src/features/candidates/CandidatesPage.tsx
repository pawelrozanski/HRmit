import type { Candidate, PipelineStage } from '@hrmit/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Switch } from '@/components/ui/switch.tsx'
import { KanbanBoard } from '../pipeline/KanbanBoard.tsx'
import { BlindContext } from './BlindContext.ts'
import { CandidateDrawer } from './CandidateDrawer.tsx'

const BLIND_KEY = 'hrmit-blind'

export function CandidatesPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const [blind, setBlind] = useState(() => localStorage.getItem(BLIND_KEY) === '1')
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [moveError, setMoveError] = useState(false)

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
      api.api.jobs[':id'].candidates.$get({ param: { id }, query: {} }).then((r) => {
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
    [id],
  )

  const toggleBlind = (on: boolean) => {
    setBlind(on)
    localStorage.setItem(BLIND_KEY, on ? '1' : '0')
  }

  const move = async (candidate: Candidate, stage: PipelineStage) => {
    const res = await api.api.candidates[':id'].stage.$patch({
      param: { id: String(candidate.id) },
      json: { stage },
    })
    if (res.status !== 200) return setMoveError(true)
    const moved = await res.json()
    setMoveError(false)
    candidates.setData((list) => list.map((c) => (c.id === moved.id ? moved : c)))
    setSelected((s) => (s?.id === moved.id ? moved : s))
  }

  if (job.error || candidates.error) return <p className="text-destructive">{t('common.error')}</p>

  return (
    <BlindContext value={blind}>
      <Link to=".." className="text-sm text-brand-dark hover:underline">
        ← {t('common.back')}
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{job.data?.title ?? t('common.loading')}</h2>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={blind} onCheckedChange={toggleBlind} />
          {t('candidates.blind')}
        </label>
      </div>
      {blind && <p className="mt-1 text-xs text-muted-foreground">{t('candidates.blindHint')}</p>}
      {moveError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t('candidates.moveFailed')}
        </p>
      )}

      {!candidates.data ? (
        <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <div className="mt-4">
          <KanbanBoard candidates={candidates.data} onOpen={setSelected} onMove={move} />
        </div>
      )}

      <CandidateDrawer candidate={selected} onClose={() => setSelected(null)} onMove={move} />
    </BlindContext>
  )
}
