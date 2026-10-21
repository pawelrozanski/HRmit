import type { EmployeeNote } from '@hrmit/shared'
import { NotebookPen, Trash2 } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Button } from '@/components/ui/button.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'

type Props = {
  employeeId: number
  /** Called with the new total after an add or a delete, so the list badge stays right. */
  onCount: (n: number) => void
}

/** Plain-text notes on one employee, newest first. Rendered as text, never as HTML. */
export function EmployeeNotes({ employeeId, onCount }: Props) {
  const { t, i18n } = useTranslation()
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const notes = useApi(
    () =>
      api.api.employees[':id'].notes.$get({ param: { id: String(employeeId) } }).then((r) => {
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
    [employeeId],
  )
  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })

  const add = async () => {
    if (!body.trim() || saving) return
    setSaving(true)
    setFailed(false)
    const res = await api.api.employees[':id'].notes.$post({
      param: { id: String(employeeId) },
      json: { body },
    })
    setSaving(false)
    if (res.status !== 201) return setFailed(true)
    const note = await res.json()
    setBody('')
    notes.setData((list) => {
      onCount(list.length + 1)
      return [note, ...list]
    })
  }
  const remove = async (note: EmployeeNote) => {
    if (!window.confirm(t('employees.notes.deleteConfirm'))) return
    const res = await api.api.employees[':id'].notes[':noteId'].$delete({
      param: { id: String(employeeId), noteId: String(note.id) },
    })
    if (res.status !== 204) return setFailed(true)
    notes.setData((list) => {
      const next = list.filter((n) => n.id !== note.id)
      onCount(next.length)
      return next
    })
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void add()
    }
  }

  return (
    <section aria-labelledby="employee-notes" className="grid gap-3 px-4 text-sm">
      <h3 id="employee-notes" className="flex items-center gap-2 font-medium">
        <NotebookPen className="size-4 text-primary" aria-hidden="true" />
        {t('employees.notes.title')}
      </h3>
      <div className="grid gap-1.5">
        <Label htmlFor="employee-note">{t('employees.notes.label')}</Label>
        <Textarea
          id="employee-note"
          rows={3}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={saving}
        />
        <p className="text-xs text-muted-foreground">{t('employees.notes.hint')}</p>
        <Button className="justify-self-start" disabled={!body.trim() || saving} onClick={add}>
          {t('employees.notes.add')}
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-destructive">
          {t('employees.notes.failed')}
        </p>
      )}
      {!notes.data ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : notes.data.length === 0 ? (
        <p className="text-muted-foreground italic">{t('employees.notes.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {notes.data.map((note) => (
            <li key={note.id} className="flex items-start gap-2 rounded-lg border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words">{note.body}</p>
                <time dateTime={note.createdAt} className="text-xs text-muted-foreground">
                  {when(note.createdAt)}
                </time>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('employees.notes.delete')}
                onClick={() => remove(note)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
