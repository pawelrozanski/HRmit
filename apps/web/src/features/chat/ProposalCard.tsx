import { Check, NotebookPen, Pencil, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '@/api/client.ts'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { APP_ROOT } from '@/config.ts'
import { useChat, type Proposal } from './ChatState.tsx'
import { resolveNames } from './chatText.ts'

/** Fired with the saved note when a proposal is stored from the chat. */
export const NOTE_SAVED = 'hrmit:note-saved'

type Props = {
  proposal: Proposal
  onChange: (p: Proposal) => void
  onNavigate: () => void
}

/**
 * A note the assistant drafted (ADR 0009). The model saved nothing: this card is the only way
 * the text reaches the database, through the ordinary notes endpoint, after the recruiter reads
 * the whole of it and clicks Save. Pseudonyms from a cloud model are swapped for the names here.
 */
export function ProposalCard({ proposal, onChange, onNavigate }: Props) {
  const { t } = useTranslation()
  const { refs } = useChat()
  const { draft } = proposal
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(draft.title ?? '')
  const [body, setBody] = useState(draft.body)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const save = useRef<HTMLButtonElement>(null)
  // The card arrives while the recruiter is reading the answer: focus goes to the decision.
  useEffect(() => void save.current?.focus(), [])

  const shown = (s: string) => resolveNames(s, refs)
  const target = draft.target
  const who =
    target === 'candidate' ? refs.candidates[draft.id]?.name : refs.employees[draft.id]?.name
  const link =
    target === 'candidate'
      ? `${APP_ROOT}/recruitments/${refs.candidates[draft.id]?.jobId ?? ''}/candidates/${draft.id}`
      : `${APP_ROOT}/employees?open=${draft.id}`

  const store = async () => {
    setBusy(true)
    setFailed(false)
    const notes = (target === 'candidate' ? api.api.candidates : api.api.employees)[':id'].notes
    const res = await notes.$post({
      param: { id: String(draft.id) },
      json: { title: shown(title).trim() || undefined, body: shown(body), source: 'assistant' },
    })
    setBusy(false)
    if (res.status !== 201) return setFailed(true)
    const saved = await res.json()
    onChange({ ...proposal, saved })
    // The page under the panel may show this person's notes: hand it the new row.
    window.dispatchEvent(new CustomEvent(NOTE_SAVED, { detail: saved }))
  }

  const heading = (
    <p className="flex items-center gap-2 font-medium">
      <NotebookPen className="size-4 text-primary" aria-hidden="true" />
      {t(`chat.proposal.${target}`, { name: who ?? `#${draft.id}` })}
    </p>
  )

  if (proposal.saved)
    return (
      <div role="group" className="mt-2 grid gap-1 rounded-lg border bg-muted/40 p-3 text-sm">
        {heading}
        <p className="text-muted-foreground">
          {t('chat.proposal.saved')}{' '}
          <Link to={link} onClick={onNavigate} className="font-medium text-primary underline">
            {t('chat.proposal.open')}
          </Link>
        </p>
      </div>
    )
  if (proposal.dismissed)
    return (
      <p className="mt-2 text-xs text-muted-foreground italic">{t('chat.proposal.dismissed')}</p>
    )

  return (
    <div
      role="group"
      aria-label={t('chat.proposal.label')}
      className="mt-2 grid gap-2 rounded-lg border border-primary/40 bg-card p-3 text-sm"
    >
      {heading}
      {editing ? (
        <>
          <div className="grid gap-1">
            <Label htmlFor="proposal-title">{t('notes.titleLabel')}</Label>
            <Input
              id="proposal-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="proposal-body">{t('notes.bodyLabel')}</Label>
            <Textarea
              id="proposal-body"
              value={body}
              rows={6}
              maxLength={5000}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </>
      ) : (
        <>
          {title.trim() && <p className="font-medium">{shown(title)}</p>}
          <p className="break-words whitespace-pre-wrap">{shown(body)}</p>
        </>
      )}
      <p className="text-xs text-muted-foreground">{t('chat.proposal.reminder')}</p>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t('notes.failed')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button ref={save} size="sm" disabled={busy || !body.trim()} onClick={store}>
          <Check data-icon="inline-start" /> {t('chat.proposal.save')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setEditing((e) => !e)}
          aria-pressed={editing}
        >
          <Pencil data-icon="inline-start" /> {t('common.edit')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => onChange({ ...proposal, dismissed: true })}
        >
          <X data-icon="inline-start" /> {t('chat.proposal.discard')}
        </Button>
      </div>
    </div>
  )
}
