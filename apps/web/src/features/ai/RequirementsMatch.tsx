import {
  isLocalProvider,
  requirementLines,
  type AiLang,
  type Candidate,
  type Job,
  type MatchStatus,
} from '@hrmit/shared'
import { CircleCheck, CircleDashed, CircleX, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { cn } from '@/lib/utils.ts'
import { useBlind } from '../candidates/BlindContext.ts'

type Props = { candidate: Candidate; job: Job; onChange: (c: Candidate) => void }

/** Colour plus icon plus word: the status never depends on colour alone (WCAG 1.4.1). */
const STYLE: Record<MatchStatus, { icon: typeof CircleCheck; text: string; border: string }> = {
  met: { icon: CircleCheck, text: 'text-match-met', border: 'border-l-match-met' },
  partial: { icon: CircleDashed, text: 'text-match-partial', border: 'border-l-match-partial' },
  missing: { icon: CircleX, text: 'text-match-missing', border: 'border-l-match-missing' },
}

/**
 * The CV against the job's requirements (ADR 0010): one AI status per requirement with its
 * evidence, never a total. Runs by itself the first time with a local model; with a cloud
 * provider nothing leaves the machine without the button (rules 2 and 3).
 */
export function RequirementsMatch({ candidate, job, onChange }: Props) {
  const { t, i18n } = useTranslation()
  const blind = useBlind()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const settings = useApi(() => api.api.settings.ai.$get().then((r) => r.json()), [])
  const isLocal = settings.data ? isLocalProvider(settings.data) : null
  const lines = requirementLines(job)
  const result = candidate.aiSummaryJson?.requirements
  const canRun = Boolean(candidate.cvText) && lines.length > 0 && !busy

  const run = async () => {
    setBusy(true)
    setError(null)
    const lang: AiLang = i18n.language.startsWith('pl') ? 'pl' : 'en'
    const res = await api.api.ai.requirements[':candidateId'].$post({
      param: { candidateId: String(candidate.id) },
      json: { lang },
    })
    setBusy(false)
    if (res.status === 200) return onChange(await res.json())
    const body = (await res.json()) as { error?: string }
    setError(body.error ?? `HTTP ${res.status}`)
  }

  // Once per candidate page: only a local model, only when there is something to compare.
  const autoRan = useRef(false)
  useEffect(() => {
    if (autoRan.current || isLocal !== true || blind || result || !canRun) return
    autoRan.current = true
    void run()
  }, [isLocal, blind, result, canRun])

  if (blind) return <p className="text-sm text-muted-foreground italic">{t('ai.hidden')}</p>
  if (lines.length === 0)
    return <p className="text-sm text-muted-foreground">{t('match.noRequirements')}</p>
  if (!candidate.cvText) return <p className="text-sm text-muted-foreground">{t('ai.noCv')}</p>

  // Edited requirements make an old result describe another list.
  const stale =
    result !== undefined &&
    lines.map((l) => l.requirement).join('\n') !== result.items.map((i) => i.requirement).join('\n')

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t('ai.badge')}</Badge>
        {isLocal !== null && (
          <Badge variant="outline">{t(isLocal ? 'ai.local' : 'ai.cloud')}</Badge>
        )}
        <Button variant="outline" size="sm" className="ml-auto" disabled={!canRun} onClick={run}>
          {result ? <RotateCcw data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
          {t(result ? 'ai.regenerate' : 'match.run')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('match.disclaimer')}</p>
      {!result && !busy && isLocal === false && (
        <p className="text-sm text-muted-foreground">{t('match.cloudHint')}</p>
      )}
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
      {stale && <p className="text-xs text-match-partial">{t('match.stale')}</p>}
      {result && (
        <>
          <ul className="grid gap-2">
            {result.items.map((item, i) => {
              const s = STYLE[item.status]
              return (
                <li key={i} className={cn('rounded-md border border-l-4 bg-card p-2', s.border)}>
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <s.icon className={cn('size-4 shrink-0', s.text)} aria-hidden="true" />
                    <span className="font-medium">{item.requirement}</span>
                    {item.kind === 'niceToHave' && (
                      <Badge variant="outline">{t('recruitments.niceToHaveLabel')}</Badge>
                    )}
                    <span className={cn('ml-auto text-xs font-semibold', s.text)}>
                      {t(`match.status.${item.status}`)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.evidence}</p>
                </li>
              )
            })}
          </ul>
          <span className="text-xs text-muted-foreground">
            {t('ai.generated', {
              model: result.model,
              date: new Date(result.generatedAt).toLocaleString(i18n.language),
            })}
          </span>
        </>
      )}
    </div>
  )
}
