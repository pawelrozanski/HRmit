import { noteInputSchema, type CandidateNote, type EmployeeNote } from '@hrmit/shared'
import { NotebookPen, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Button } from '@/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { fieldErrors } from '@/lib/form.ts'

type Note = EmployeeNote | CandidateNote
export type NoteTarget = 'candidate' | 'employee'

type Props = {
  target: NoteTarget
  id: number
  /** Called with the new total after an add or a delete, so a list badge stays right. */
  onCount?: (n: number) => void
}

/** The two note resources share one contract; this picks the endpoint. */
const notesApi = (target: NoteTarget) =>
  (target === 'candidate' ? api.api.candidates : api.api.employees)[':id'].notes

/** Plain-text notes on one candidate or employee, newest first. Rendered as text, never as HTML. */
export function NotesSection({ target, id, onCount = () => {} }: Props) {
  const { t, i18n } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<Note | null>(null)
  const [failed, setFailed] = useState(false)
  const notes = useApi(
    () =>
      notesApi(target)
        .$get({ param: { id: String(id) } })
        .then((r) => {
          if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
          return r.json() as Promise<Note[]>
        }),
    [target, id],
  )
  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })

  const remove = async (note: Note) => {
    if (!window.confirm(t('notes.deleteConfirm'))) return
    const res = await notesApi(target)[':noteId'].$delete({
      param: { id: String(id), noteId: String(note.id) },
    })
    if (res.status !== 204) return setFailed(true)
    setOpen(null)
    notes.setData((list) => {
      const next = list.filter((n) => n.id !== note.id)
      onCount(next.length)
      return next
    })
  }

  return (
    <section aria-labelledby={`${target}-notes`} className="grid gap-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${target}-notes`} className="flex items-center gap-2 font-medium">
          <NotebookPen className="size-4 text-primary" aria-hidden="true" />
          {t('notes.title')}
          {notes.data && notes.data.length > 0 && (
            <span className="font-normal text-muted-foreground">({notes.data.length})</span>
          )}
        </h3>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus data-icon="inline-start" /> {t('notes.add')}
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-destructive">
          {t('notes.failed')}
        </p>
      )}
      {!notes.data ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : notes.data.length === 0 ? (
        <p className="text-muted-foreground italic">{t('notes.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {notes.data.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => setOpen(note)}
                className="flex w-full items-baseline justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className={note.title ? 'truncate' : 'text-muted-foreground italic'}>
                  {note.title ?? t('notes.untitled')}
                </span>
                {note.source === 'assistant' && (
                  <Sparkles
                    className="size-3.5 shrink-0 text-primary"
                    aria-label={t('notes.assistant')}
                  />
                )}
                <time dateTime={note.createdAt} className="shrink-0 text-xs text-muted-foreground">
                  {when(note.createdAt)}
                </time>
              </button>
            </li>
          ))}
        </ul>
      )}
      <NoteForm
        key={adding ? 'open' : 'closed'}
        target={target}
        id={id}
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(note) => {
          setAdding(false)
          notes.setData((list) => {
            onCount(list.length + 1)
            return [note, ...list]
          })
        }}
      />
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className={open.title ? '' : 'text-muted-foreground italic'}>
                  {open.title ?? t('notes.untitled')}
                </DialogTitle>
                <DialogDescription>
                  <time dateTime={open.createdAt}>{when(open.createdAt)}</time>
                  {open.source === 'assistant' && (
                    <span className="mt-1 flex items-center gap-1 text-primary">
                      <Sparkles className="size-3.5" aria-hidden="true" /> {t('notes.assistant')}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <p className="max-h-[60vh] overflow-y-auto break-words whitespace-pre-wrap">
                {open.body}
              </p>
              <DialogFooter>
                <Button variant="destructive" onClick={() => remove(open)}>
                  <Trash2 data-icon="inline-start" /> {t('common.delete')}
                </Button>
                <Button variant="outline" onClick={() => setOpen(null)}>
                  {t('common.close')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

type FormProps = {
  target: NoteTarget
  id: number
  open: boolean
  onClose: () => void
  onSaved: (note: Note) => void
}

/** Plain <form> + FormData, validated with the shared zod schema, like the other forms. */
function NoteForm({ target, id, open, onClose, onSaved }: FormProps) {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const parsed = noteInputSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues, t))
    setErrors({})
    const res = await notesApi(target).$post({ param: { id: String(id) }, json: parsed.data })
    if (res.status !== 201) return setFailed(true)
    setFailed(false)
    onSaved(await res.json())
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('notes.add')}</DialogTitle>
            <DialogDescription>{t('notes.hint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="note-title">{t('notes.titleLabel')}</Label>
            <Input id="note-title" name="title" maxLength={120} aria-invalid={!!errors.title} />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="note-body">{t('notes.bodyLabel')}</Label>
            <Textarea
              id="note-body"
              name="body"
              rows={6}
              maxLength={5000}
              onKeyDown={onKeyDown}
              aria-invalid={!!errors.body}
            />
            {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
          </div>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t('form.saveFailed')}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
