import type { Candidate } from '@hrmit/shared'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Button } from '@/components/ui/button.tsx'

type Props = { candidate: Candidate; onOpenInterview: () => void }

/**
 * The scorecard at a glance for the candidate dashboard: averages per competency and the
 * interviewers' comments, read only. Scoring happens in the Interview tab. No total (ADR 0004).
 */
export function InterviewSummary({ candidate, onOpenInterview }: Props) {
  const { t } = useTranslation()
  const card = useApi(
    () =>
      api.api.candidates[':id'].scorecard
        .$get({ param: { id: String(candidate.id) } })
        .then((r) => {
          if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
          return r.json()
        }),
    [candidate.id],
  )
  if (card.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!card.data) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>

  const entries = card.data.evaluations
  const groups = new Map<string, typeof entries>()
  for (const e of entries) groups.set(e.competency, [...(groups.get(e.competency) ?? []), e])
  const scored = entries.filter((e) => e.score !== null).length
  const comments = entries.filter((e) => e.note.trim())

  return (
    <div className="grid gap-3 text-sm">
      {entries.length === 0 ? (
        <p className="text-muted-foreground">{t('interview.noQuestions')}</p>
      ) : scored === 0 && comments.length === 0 ? (
        <p className="text-muted-foreground">{t('interview.notYet', { m: entries.length })}</p>
      ) : (
        <>
          <ul className="grid gap-1">
            {[...groups].map(([competency, list]) => {
              const done = list.filter((e) => e.score !== null)
              const avg = done.reduce((s, e) => s + (e.score ?? 0), 0) / done.length
              return (
                <li key={competency} className="flex flex-wrap justify-between gap-x-3">
                  <span className="font-medium">{competency}</span>
                  <span className="text-muted-foreground">
                    {done.length
                      ? t('scorecard.average', {
                          avg: avg.toFixed(1),
                          n: done.length,
                          m: list.length,
                        })
                      : t('scorecard.unscored')}
                  </span>
                </li>
              )
            })}
          </ul>
          {comments.length > 0 && (
            <ul className="grid gap-1 border-t pt-2 text-muted-foreground">
              {comments.map((e) => (
                <li key={e.questionId}>
                  <span className="text-foreground">{e.competency}:</span> {e.note}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <Button variant="outline" size="sm" className="justify-self-start" onClick={onOpenInterview}>
        {t('interview.open')}
      </Button>
    </div>
  )
}
