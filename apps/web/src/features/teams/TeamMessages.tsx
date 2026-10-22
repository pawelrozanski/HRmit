import {
  sendTeamEmailInputSchema,
  type TeamDetail,
  type TeamEmail,
  type TeamSendResult,
} from '@hrmit/shared'
import { Mail, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
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
import { IS_DEMO } from '@/config.ts'
import { fieldErrors } from '@/lib/form.ts'
import { fullName } from '../employees/EmployeeDrawer.tsx'
import { MESSAGE_BADGE, MessageFields, SendError, useWhen } from '../employees/EmployeeMessages.tsx'

/** One send from the team view: every row of it shares sentAt (set once by the server). */
type Send = { key: string; subject: string; sentAt: string; rows: TeamEmail[] }

const groupSends = (rows: TeamEmail[]): Send[] => {
  const sends: Send[] = []
  for (const r of rows) {
    const key = `${r.sentAt}|${r.subject}`
    const last = sends[sends.length - 1]
    if (last?.key === key) last.rows.push(r)
    else sends.push({ key, subject: r.subject, sentAt: r.sentAt, rows: [r] })
  }
  return sends
}

/** Messages sent from this team, newest first, grouped per send, and the send dialog. */
export function TeamMessages({ team }: { team: TeamDetail }) {
  const { t } = useTranslation()
  const when = useWhen()
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<TeamSendResult | null>(null)
  // Bumped after a send: the history is re-read (failed rows carry no name in the result).
  const [version, setVersion] = useState(0)
  const history = useApi(
    () =>
      api.api.teams[':id'].emails.$get({ param: { id: String(team.id) } }).then((r) => {
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
    [team.id, version],
  )
  const total = notice ? notice.sent.length + notice.failed.length : 0

  return (
    <section className="mt-6" aria-labelledby="team-messages">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id="team-messages" className="flex items-center gap-2 font-semibold">
          <Mail className="size-4 text-primary" aria-hidden="true" />
          {t('messages.title')}
        </h3>
        <Button
          variant="outline"
          size="sm"
          disabled={team.members.length === 0}
          onClick={() => setOpen(true)}
        >
          <Send data-icon="inline-start" /> {t('messages.send')}
        </Button>
      </div>
      {notice && (
        <p
          role="status"
          className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
            notice.failed.length ? 'border-destructive/40' : 'bg-muted'
          }`}
        >
          {t('messages.summary', { sent: notice.sent.length, total })}
          {notice.failed.length > 0 && (
            <span className="text-destructive">
              {' · '}
              {t('messages.failedNames', { names: notice.failed.map((f) => f.name).join(', ') })}
            </span>
          )}
        </p>
      )}
      {history.error ? (
        <p className="text-sm text-destructive">{t('common.error')}</p>
      ) : !history.data ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : history.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('messages.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {groupSends(history.data).map((s) => {
            const counts = new Map<TeamEmail['status'], number>()
            for (const r of s.rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
            return (
              <li
                key={s.key}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border bg-card p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={s.sentAt}>{when(s.sentAt)}</time>
                    {' · '}
                    {t('messages.recipientCount', { count: s.rows.length })}
                  </p>
                </div>
                <span className="flex flex-wrap gap-1">
                  {[...counts].map(([status, n]) => (
                    <Badge key={status} variant={MESSAGE_BADGE[status]}>
                      {t(`email.status.${status}`)} {n}
                    </Badge>
                  ))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <SendTeamMessageDialog
        key={open ? 'open' : 'closed'}
        team={team}
        open={open}
        onClose={() => setOpen(false)}
        onSent={(result) => {
          setOpen(false)
          setNotice(result)
          setVersion((v) => v + 1)
        }}
      />
    </section>
  )
}

type DialogProps = {
  team: TeamDetail
  open: boolean
  onClose: () => void
  onSent: (result: TeamSendResult) => void
}

/**
 * Recipient picker on top (native checkboxes, like AddMembersDialog), then subject and body.
 * Send is disabled with nobody picked; the count sits next to the button.
 */
function SendTeamMessageDialog({ team, open, onClose, onSent }: DialogProps) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<number[]>(() => team.members.map((m) => m.id))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  const toggle = (id: number, on: boolean) =>
    setPicked((list) => (on ? [...list, id] : list.filter((x) => x !== id)))

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const parsed = sendTeamEmailInputSchema.safeParse({
      subject: form.get('subject'),
      body: form.get('body'),
      employeeIds: picked,
    })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues, t))
    setErrors({})
    setSending(true)
    const res = await api.api.teams[':id'].emails.$post({
      param: { id: String(team.id) },
      json: parsed.data,
    })
    setSending(false)
    if (res.status !== 201) return setFailed(res.status)
    onSent(await res.json())
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('messages.send')}</DialogTitle>
            <DialogDescription>
              {IS_DEMO ? t('messages.demoHint') : t('messages.hint')}
            </DialogDescription>
          </DialogHeader>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t('messages.recipients')}</legend>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPicked(team.members.map((m) => m.id))}
              >
                {t('messages.selectAll')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPicked(team.members.filter((m) => m.role === 'lead').map((m) => m.id))
                }
              >
                {t('messages.leadsOnly')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPicked([])}>
                {t('messages.clear')}
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border">
              {team.members.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    aria-label={fullName(m)}
                    checked={picked.includes(m.id)}
                    onChange={(ev) => toggle(m.id, ev.target.checked)}
                  />
                  <span className="font-medium">{fullName(m)}</span>
                  <span className="text-muted-foreground">{m.position}</span>
                  {m.role === 'lead' && <Badge>{t('teams.roles.lead')}</Badge>}
                </label>
              ))}
            </div>
          </fieldset>
          <MessageFields errors={errors} rows={6} />
          {failed !== null && <SendError status={failed} />}
          <DialogFooter className="sm:items-center">
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {t('messages.selected', { count: picked.length })}
            </span>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={picked.length === 0 || sending}>
              <Send data-icon="inline-start" />{' '}
              {sending ? t('messages.sending') : t('messages.send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
