import type { Candidate, Scorecard as ScorecardData } from '@hrmit/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Button } from '@/components/ui/button.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'

type Entry = ScorecardData['evaluations'][number]
type Props = { candidate: Candidate; onOpenGuide: () => void }

const SCORES = [1, 2, 3, 4, 5] as const

/**
 * Structured interview scorecard (ADR 0004): the job's questions, a human's 1 to 5 score and a
 * note on each, averaged per competency. Deliberately no total and no comparison: the drawer
 * shows one candidate, and the numbers describe answers, not a verdict. Nothing identifying is
 * rendered, so blind mode needs no special case.
 */
export function Scorecard({ candidate, onOpenGuide }: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Entry[] | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const param = { id: String(candidate.id) }
  const loaded = useApi(
    () =>
      api.api.candidates[':id'].scorecard.$get({ param }).then(async (r) => {
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
        const card = await r.json()
        setDraft(card.evaluations)
        setDirty(false)
        return card
      }),
    [candidate.id],
  )

  const edit = (questionId: number, patch: Partial<Entry>) => {
    setDraft(
      (list) => list && list.map((e) => (e.questionId === questionId ? { ...e, ...patch } : e)),
    )
    setDirty(true)
  }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    setError(false)
    const res = await api.api.candidates[':id'].scorecard.$put({
      param,
      json: draft.map(({ questionId, score, note }) => ({ questionId, score, note })),
    })
    setSaving(false)
    if (res.status !== 200) return setError(true)
    setDraft((await res.json()).evaluations)
    setDirty(false)
  }

  if (loaded.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!draft) return <p className="text-muted-foreground">{t('common.loading')}</p>
  if (draft.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {t('scorecard.empty')}{' '}
        <button type="button" className="text-brand-dark underline" onClick={onOpenGuide}>
          {t('candidates.guide')}
        </button>
      </p>
    )

  // Group by competency in order of first appearance; the guide keeps them together anyway.
  const groups = new Map<string, Entry[]>()
  for (const e of draft) groups.set(e.competency, [...(groups.get(e.competency) ?? []), e])

  return (
    <div className="grid gap-4">
      <p className="text-xs text-muted-foreground">{t('scorecard.intro')}</p>
      {[...groups].map(([competency, entries]) => {
        const scored = entries.filter((e) => e.score !== null)
        const avg = scored.reduce((sum, e) => sum + (e.score ?? 0), 0) / scored.length
        return (
          <section key={competency} className="grid gap-2">
            <h3 className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-semibold text-brand-dark">
              {competency}
              <span className="font-normal text-muted-foreground">
                {scored.length
                  ? t('scorecard.average', {
                      avg: avg.toFixed(1),
                      n: scored.length,
                      m: entries.length,
                    })
                  : t('scorecard.unscored')}
              </span>
            </h3>
            {entries.map((e) => (
              <div key={e.questionId} className="grid gap-2 rounded-lg border bg-white p-2">
                <p className="text-sm">{e.question}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div role="radiogroup" aria-label={t('scorecard.score')} className="flex gap-1">
                    {SCORES.map((n) => (
                      <label
                        key={n}
                        className="flex size-8 cursor-pointer items-center justify-center rounded-md border text-sm has-checked:border-brand has-checked:bg-brand-dark has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-ring"
                      >
                        <input
                          type="radio"
                          name={`score-${candidate.id}-${e.questionId}`}
                          className="sr-only"
                          aria-label={t('scorecard.scoreLabel', { n })}
                          checked={e.score === n}
                          onChange={() => edit(e.questionId, { score: n })}
                        />
                        {n}
                      </label>
                    ))}
                  </div>
                  {e.score !== null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => edit(e.questionId, { score: null })}
                    >
                      {t('scorecard.clear')}
                    </Button>
                  )}
                </div>
                <Textarea
                  aria-label={t('scorecard.note')}
                  placeholder={t('scorecard.note')}
                  rows={2}
                  value={e.note}
                  onChange={(ev) => edit(e.questionId, { note: ev.target.value })}
                />
              </div>
            ))}
          </section>
        )
      })}
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={!dirty || saving} onClick={save}>
          {t('common.save')}
        </Button>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {t('form.saveFailed')}
          </p>
        )}
      </div>
    </div>
  )
}
