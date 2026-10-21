import { isLocalProvider, type AiLang, type AiSummary, type Candidate } from '@hrmit/shared'
import { ListChecks, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { useBlind } from '../candidates/BlindContext.ts'
import { AnonymizePreview } from './AnonymizePreview.tsx'
import { useTypewriter } from './useTypewriter.ts'

type Props = { candidate: Candidate; onChange: (c: Candidate) => void }
type Action = keyof AiSummary

/** Two buttons, two results, one disclaimer. ADR 0004: suggestions a human keeps or discards. */
export function AiSection({ candidate, onChange }: Props) {
  const { t, i18n } = useTranslation()
  const blind = useBlind()
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Which result was produced in this session: only that one gets the typing effect.
  const [fresh, setFresh] = useState<Action | null>(null)
  const settings = useApi(() => api.api.settings.ai.$get().then((r) => r.json()), [])
  // Same rule as the server (packages/shared): Ollama, or an OpenAI-compatible endpoint on a
  // loopback or private host, is local; everything else gets anonymized text.
  const isLocal = settings.data ? isLocalProvider(settings.data) : null

  const run = async (action: Action) => {
    setBusy(action)
    setError(null)
    const lang: AiLang = i18n.language.startsWith('pl') ? 'pl' : 'en'
    const route = action === 'summary' ? api.api.ai.summarize : api.api.ai.competencies
    const res = await route[':candidateId'].$post({
      param: { candidateId: String(candidate.id) },
      json: { lang },
    })
    setBusy(null)
    if (res.status === 200) {
      setFresh(action)
      return onChange(await res.json())
    }
    const body = (await res.json()) as { error?: string }
    setError(body.error ?? `HTTP ${res.status}`)
  }

  const discard = async () => {
    const res = await api.api.ai.summary[':candidateId'].$delete({
      param: { candidateId: String(candidate.id) },
    })
    if (res.status === 200) onChange(await res.json())
  }

  if (blind) return <p className="text-sm text-muted-foreground italic">{t('ai.hidden')}</p>

  const ai = candidate.aiSummaryJson
  const canRun = Boolean(candidate.cvText) && busy === null
  const date = (iso: string) => new Date(iso).toLocaleString(i18n.language)

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={!canRun} onClick={() => run('summary')}>
          <Sparkles data-icon="inline-start" /> {t('ai.summarize')}
        </Button>
        <Button variant="outline" size="sm" disabled={!canRun} onClick={() => run('competencies')}>
          <ListChecks data-icon="inline-start" /> {t('ai.competencies')}
        </Button>
        <AnonymizePreview candidateId={candidate.id} disabled={!candidate.cvText} />
      </div>
      {!candidate.cvText && <p className="text-xs text-muted-foreground">{t('ai.noCv')}</p>}
      {busy && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t('ai.working')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {t('ai.failed', { error })}
        </p>
      )}
      {ai && (ai.summary || ai.competencies) && (
        <div className="grid gap-3 rounded-lg border border-brand/40 bg-brand/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{t('ai.badge')}</Badge>
            {isLocal !== null && (
              <Badge variant="outline">{t(isLocal ? 'ai.local' : 'ai.cloud')}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('ai.disclaimer')}</p>
          {ai.summary && (
            <Result
              title={t('ai.summary')}
              meta={t('ai.generated', {
                model: ai.summary.model,
                date: date(ai.summary.generatedAt),
              })}
              parts={[ai.summary.summary, ...ai.summary.highlights]}
              animate={fresh === 'summary'}
              listTitle={t('ai.highlights')}
              onRegenerate={() => run('summary')}
              disabled={!canRun}
            />
          )}
          {ai.competencies && (
            <Result
              title={t('ai.competenciesTitle')}
              meta={t('ai.generated', {
                model: ai.competencies.model,
                date: date(ai.competencies.generatedAt),
              })}
              parts={ai.competencies.competencies.map((c) => `${c.name}: ${c.evidence}`)}
              animate={fresh === 'competencies'}
              onRegenerate={() => run('competencies')}
              disabled={!canRun}
            />
          )}
          <Button variant="ghost" size="sm" className="justify-self-start" onClick={discard}>
            <Trash2 data-icon="inline-start" /> {t('ai.discard')}
          </Button>
        </div>
      )}
    </div>
  )
}

type ResultProps = {
  title: string
  meta: string
  /** First part is a paragraph, the rest are list items; the list gets its own title. */
  parts: string[]
  listTitle?: string
  animate: boolean
  onRegenerate: () => void
  disabled: boolean
}

function Result({ title, meta, parts, listTitle, animate, onRegenerate, disabled }: ResultProps) {
  const { t } = useTranslation()
  const typed = useTypewriter(parts, animate)
  const [first, ...rest] = listTitle ? typed : ['', ...typed]
  return (
    <div className="grid gap-1 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{title}</span>
        <Button variant="ghost" size="xs" disabled={disabled} onClick={onRegenerate}>
          <RotateCcw data-icon="inline-start" /> {t('ai.regenerate')}
        </Button>
      </div>
      {first && <p>{first}</p>}
      {listTitle && rest.some(Boolean) && (
        <span className="mt-1 text-xs text-muted-foreground uppercase">{listTitle}</span>
      )}
      <ul className="list-disc pl-5">
        {rest.filter(Boolean).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      <span className="text-xs text-muted-foreground">{meta}</span>
    </div>
  )
}
