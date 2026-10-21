import type { AiLang, InterviewQuestionInput } from '@hrmit/shared'
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { useTypewriter } from '../ai/useTypewriter.ts'

type Props = { jobId: number }
type Proposal = { questions: InterviewQuestionInput[]; applied: boolean }

const strip = (q: InterviewQuestionInput) => ({ competency: q.competency, question: q.question })

/**
 * The job's structured interview guide (ADR 0004): one editable, ordered list shared by every
 * candidate. The draft lives in state and Save PUTs the whole list; the server keeps the order.
 */
export function InterviewGuide({ jobId }: Props) {
  const { t, i18n } = useTranslation()
  const [draft, setDraft] = useState<InterviewQuestionInput[] | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<'save' | 'generate' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const param = { id: String(jobId) }
  const loaded = useApi(
    () =>
      api.api.jobs[':id'].questions.$get({ param }).then(async (r) => {
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
        const list = (await r.json()).map(strip)
        setDraft(list)
        setDirty(false)
        return list
      }),
    [jobId],
  )

  const edit = (update: (list: InterviewQuestionInput[]) => InterviewQuestionInput[]) => {
    setDraft((list) => (list ? update(list) : list))
    setDirty(true)
  }
  const move = (i: number, dir: -1 | 1) =>
    edit((list) => {
      const next = [...list]
      const [item] = next.splice(i, 1)
      next.splice(i + dir, 0, item!)
      return next
    })

  const save = async (list: InterviewQuestionInput[]) => {
    setBusy('save')
    setError(null)
    const res = await api.api.jobs[':id'].questions.$put({ param, json: list })
    setBusy(null)
    if (res.status !== 200) return setError(`HTTP ${res.status}`)
    const saved = (await res.json()).map(strip)
    setDraft(saved)
    setDirty(false)
    setProposal(null)
  }

  const generate = async () => {
    setBusy('generate')
    setError(null)
    const lang: AiLang = i18n.language.startsWith('pl') ? 'pl' : 'en'
    const res = await api.api.ai.questions[':jobId'].$post({
      param: { jobId: String(jobId) },
      json: { lang },
    })
    setBusy(null)
    if (res.status !== 200) {
      const body = (await res.json()) as { error?: string }
      return setError(body.error ?? `HTTP ${res.status}`)
    }
    const result = await res.json()
    setProposal(result)
    if (result.applied) {
      setDraft(result.questions)
      setDirty(false)
    }
  }

  if (loaded.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!draft) return <p className="text-muted-foreground">{t('common.loading')}</p>

  const valid = draft.every((q) => q.competency.trim() && q.question.trim())

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t('questions.intro')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={generate}>
          <Sparkles data-icon="inline-start" /> {t('questions.generate')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() =>
            edit((list) => [...list, { competency: list.at(-1)?.competency ?? '', question: '' }])
          }
        >
          <Plus data-icon="inline-start" /> {t('questions.add')}
        </Button>
        <Button size="sm" disabled={!dirty || !valid || busy !== null} onClick={() => save(draft)}>
          {t('common.save')}
        </Button>
      </div>
      {busy === 'generate' && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t('ai.working')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {t('ai.failed', { error })}
        </p>
      )}
      {proposal && (
        <ProposalBlock
          proposal={proposal}
          disabled={busy !== null}
          onUse={() => save(proposal.questions)}
          onClose={() => setProposal(null)}
        />
      )}

      {draft.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('questions.empty')}</p>
      ) : (
        <ol className="grid gap-2">
          {draft.map((q, i) => (
            <li key={i} className="grid gap-2">
              {q.competency !== draft[i - 1]?.competency && (
                <h3 className="mt-2 text-sm font-semibold text-primary">
                  {q.competency.trim() || t('questions.noCompetency')}
                </h3>
              )}
              <div className="grid gap-2 rounded-lg border bg-card p-2 sm:grid-cols-[1fr_2fr_auto]">
                <Input
                  aria-label={t('questions.competency')}
                  placeholder={t('questions.competency')}
                  value={q.competency}
                  onChange={(e) =>
                    edit((list) =>
                      list.map((x, j) => (j === i ? { ...x, competency: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  aria-label={t('questions.question')}
                  placeholder={t('questions.question')}
                  value={q.question}
                  onChange={(e) =>
                    edit((list) =>
                      list.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)),
                    )
                  }
                />
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('questions.moveUp')}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('questions.moveDown')}
                    disabled={i === draft.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('common.delete')}
                    onClick={() => edit((list) => list.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {dirty && !valid && (
        <p className="text-xs text-muted-foreground">{t('questions.incomplete')}</p>
      )}
    </div>
  )
}

type ProposalProps = {
  proposal: Proposal
  disabled: boolean
  onUse: () => void
  onClose: () => void
}

/** The model's set, typed out. Applied already (empty job) or waiting for the human's click. */
function ProposalBlock({ proposal, disabled, onUse, onClose }: ProposalProps) {
  const { t } = useTranslation()
  const typed = useTypewriter(
    proposal.questions.map((q) => `${q.competency}: ${q.question}`),
    true,
  )
  return (
    <div className="grid gap-3 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t('ai.badge')}</Badge>
        {proposal.applied && <Badge variant="outline">{t('questions.applied')}</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">{t('questions.disclaimer')}</p>
      <ol className="list-decimal pl-5">
        {typed.filter(Boolean).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {proposal.applied ? (
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        ) : (
          <>
            <Button size="sm" disabled={disabled} onClick={onUse}>
              {t('questions.use')}
            </Button>
            <Button variant="ghost" size="sm" disabled={disabled} onClick={onClose}>
              <Trash2 data-icon="inline-start" /> {t('ai.discard')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
