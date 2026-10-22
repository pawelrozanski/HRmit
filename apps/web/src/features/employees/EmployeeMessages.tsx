import {
  sendEmployeeEmailInputSchema,
  type Employee,
  type EmployeeEmail,
  type SendEmployeeEmailInput,
} from '@hrmit/shared'
import { Mail, Send } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Badge } from '@/components/ui/badge.tsx'
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
import { APP_ROOT, IS_DEMO } from '@/config.ts'
import { fieldErrors } from '@/lib/form.ts'

export const MESSAGE_BADGE: Record<
  EmployeeEmail['status'],
  'default' | 'destructive' | 'secondary'
> = {
  sent: 'default',
  failed: 'destructive',
  demo: 'secondary',
}

/** Date and time in the UI language, for history rows. */
export const useWhen = () => {
  const { i18n } = useTranslation()
  return (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
}

/** Ctrl/Cmd+Enter in the body submits the surrounding form. */
export const submitOnCtrlEnter = (e: KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    e.currentTarget.form?.requestSubmit()
  }
}

/** Send errors: a 409 points at the SMTP settings, anything else is a generic retry line. */
export function SendError({ status }: { status: number }) {
  const { t } = useTranslation()
  return (
    <p role="alert" className="text-sm text-destructive">
      {status === 409 ? (
        <>
          {t('messages.notConfigured')}{' '}
          <Link to={`${APP_ROOT}/settings/email`} className="underline">
            {t('messages.openSettings')}
          </Link>
        </>
      ) : (
        t('messages.sendFailed')
      )}
    </p>
  )
}

type FieldsProps = {
  errors: Record<string, string>
  /** Textarea rows; the team dialog has a picker above and keeps the body shorter. */
  rows?: number
  /** The employee dialog starts in the subject (the recipient is fixed). */
  autoFocus?: boolean
}

/** Subject and body, plain text; validated by the shared schema in the submit handler. */
export function MessageFields({ errors, rows = 8, autoFocus }: FieldsProps) {
  const { t } = useTranslation()
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor="message-subject">{t('messages.subject')}</Label>
        <Input
          id="message-subject"
          name="subject"
          maxLength={200}
          autoFocus={autoFocus}
          aria-invalid={!!errors.subject}
        />
        {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="message-body">{t('messages.body')}</Label>
        <Textarea
          id="message-body"
          name="body"
          rows={rows}
          maxLength={10000}
          onKeyDown={submitOnCtrlEnter}
          aria-invalid={!!errors.body}
        />
        {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
      </div>
    </>
  )
}

/** History of messages sent to one employee, newest first, and the send dialog. */
export function EmployeeMessages({ employee }: { employee: Employee }) {
  const { t } = useTranslation()
  const when = useWhen()
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<EmployeeEmail | null>(null)
  const history = useApi(
    () =>
      api.api.employees[':id'].emails.$get({ param: { id: String(employee.id) } }).then((r) => {
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
    [employee.id],
  )

  return (
    <section aria-labelledby="employee-messages" className="grid gap-3 px-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 id="employee-messages" className="flex items-center gap-2 font-medium">
          <Mail className="size-4 text-primary" aria-hidden="true" />
          {t('messages.title')}
          {history.data && history.data.length > 0 && (
            <span className="font-normal text-muted-foreground">({history.data.length})</span>
          )}
        </h3>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Send data-icon="inline-start" /> {t('messages.send')}
        </Button>
      </div>
      {notice && (
        <p
          role="status"
          className={
            notice.status === 'failed'
              ? 'rounded-lg border border-destructive/40 px-3 py-2 text-destructive'
              : 'rounded-lg border bg-muted px-3 py-2'
          }
        >
          {notice.status === 'failed'
            ? t('messages.failedOne', { error: notice.error })
            : t('messages.sentOne')}
        </p>
      )}
      {history.error ? (
        <p className="text-destructive">{t('common.error')}</p>
      ) : !history.data ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : history.data.length === 0 ? (
        <p className="text-muted-foreground italic">{t('messages.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {history.data.map((m) => (
            <li
              key={m.id}
              className="flex items-start justify-between gap-2 rounded-lg border bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate">{m.subject}</p>
                <p className="text-xs text-muted-foreground">
                  <time dateTime={m.sentAt}>{when(m.sentAt)}</time>
                  {m.error && <span className="text-destructive"> · {m.error}</span>}
                </p>
              </div>
              <Badge variant={MESSAGE_BADGE[m.status]}>{t(`email.status.${m.status}`)}</Badge>
            </li>
          ))}
        </ul>
      )}
      <SendMessageDialog
        key={open ? 'open' : 'closed'}
        employee={employee}
        open={open}
        onClose={() => setOpen(false)}
        onSent={(row) => {
          setOpen(false)
          setNotice(row)
          history.setData((list) => [row, ...list])
        }}
      />
    </section>
  )
}

type DialogProps = {
  employee: Employee
  open: boolean
  onClose: () => void
  onSent: (row: EmployeeEmail) => void
}

/** Plain <form> + FormData, like NoteForm: the recipient is fixed, subject and body are typed. */
function SendMessageDialog({ employee, open, onClose, onSent }: DialogProps) {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const parsed = sendEmployeeEmailInputSchema.safeParse(
      Object.fromEntries(new FormData(e.currentTarget)) as SendEmployeeEmailInput,
    )
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues, t))
    setErrors({})
    setSending(true)
    const res = await api.api.employees[':id'].emails.$post({
      param: { id: String(employee.id) },
      json: parsed.data,
    })
    setSending(false)
    if (res.status !== 201) return setFailed(res.status)
    onSent(await res.json())
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('messages.send')}</DialogTitle>
            <DialogDescription>
              {IS_DEMO ? t('messages.demoHint') : t('messages.hint')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="message-to">{t('messages.to')}</Label>
            <Input id="message-to" value={employee.email} readOnly tabIndex={-1} />
          </div>
          <MessageFields errors={errors} autoFocus />
          {failed !== null && <SendError status={failed} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={sending}>
              <Send data-icon="inline-start" />{' '}
              {sending ? t('messages.sending') : t('messages.send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
