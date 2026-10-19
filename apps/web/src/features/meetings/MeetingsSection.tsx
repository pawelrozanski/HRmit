import type { Candidate, Meeting, MeetingPreview, MeetingResult } from '@hrmit/shared'
import { CalendarPlus, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { IS_DEMO } from '@/config.ts'
import { useBlind } from '../candidates/BlindContext.ts'

const DURATIONS = [30, 45, 60, 90]

/** Next working day at 10:00 local time, as the datetime-local input wants it (no zone). */
function defaultStart(): string {
  const d = new Date()
  do d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6)
  d.setHours(10, 0, 0, 0)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

type Props = { candidate: Candidate; onScheduled: (r: MeetingResult) => void }

/** Scheduled interviews (docs/ARCHITECTURE.md §6) and the door to the schedule dialog. */
export function MeetingsSection({ candidate, onScheduled }: Props) {
  const { t, i18n } = useTranslation()
  const blind = useBlind()
  const [open, setOpen] = useState(false)
  const param = { id: String(candidate.id) }
  const list = useApi(
    () =>
      api.api.candidates[':id'].meetings.$get({ param }).then(async (r) => {
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
    [candidate.id],
  )

  if (blind) return <p className="text-sm text-muted-foreground italic">{t('email.hidden')}</p>
  if (list.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!list.data) return <p className="text-muted-foreground">{t('common.loading')}</p>

  return (
    <div className="grid gap-3">
      {list.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('meetings.none')}</p>
      ) : (
        <ul className="grid gap-2">
          {list.data.map((m: Meeting) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {new Date(m.startsAt).toLocaleString(i18n.language)} ·{' '}
                {t('meetings.minutes', { count: m.durationMin })}
              </span>
              <a
                href={m.jitsiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-brand-dark underline"
              >
                Jitsi <ExternalLink className="size-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <CalendarPlus data-icon="inline-start" /> {t('meetings.schedule')}
        </Button>
      </div>
      {open && (
        <ScheduleDialog
          candidate={candidate}
          onClose={() => setOpen(false)}
          onScheduled={(r) => {
            if (r.meeting) {
              const m = r.meeting
              list.setData((rows) => [m, ...rows])
            }
            onScheduled(r)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

type DialogProps = Props & { onClose: () => void }

/** Date and duration pick the slot; the rendered invite is editable, what is shown is what is sent. */
function ScheduleDialog({ candidate, onClose, onScheduled }: DialogProps) {
  const { t } = useTranslation()
  const [local, setLocal] = useState(defaultStart)
  const [durationMin, setDurationMin] = useState(60)
  const [draft, setDraft] = useState<MeetingPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const param = { id: String(candidate.id) }
  // The input has no zone; Date reads it as local time and gives back the UTC instant.
  const startsAt = Number.isNaN(Date.parse(local)) ? null : new Date(local).toISOString()

  useEffect(() => {
    if (!startsAt) return
    let live = true
    setDraft(null)
    api.api.candidates[':id'].meetings.preview
      .$get({ param, query: { startsAt } })
      .then(async (r) => {
        if (live && r.status === 200) setDraft(await r.json())
      })
    return () => {
      live = false
    }
  }, [candidate.id, startsAt])

  const send = async () => {
    if (!draft || !startsAt) return
    setSending(true)
    setError(null)
    const res = await api.api.candidates[':id'].meetings.$post({
      param,
      json: { startsAt, durationMin, ...draft },
    })
    setSending(false)
    if (res.status !== 201) {
      return setError(res.status === 409 ? t('email.notConfigured') : t('form.saveFailed'))
    }
    const result = await res.json()
    if (!result.meeting) return setError(result.email.error ?? t('form.saveFailed'))
    onScheduled(result)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('meetings.dialogTitle', { email: candidate.email })}</DialogTitle>
          <DialogDescription>
            {IS_DEMO ? t('meetings.demoHint') : t('meetings.hint')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="meeting-start">{t('meetings.when')}</Label>
              <Input
                id="meeting-start"
                type="datetime-local"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="meeting-duration">{t('meetings.duration')}</Label>
              <select
                id="meeting-duration"
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="h-8 rounded-lg border bg-background px-2 text-sm"
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {t('meetings.minutes', { count: d })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm">
            {t('meetings.link')}:{' '}
            {draft ? (
              <a
                href={draft.jitsiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-brand-dark underline"
              >
                {draft.jitsiUrl}
              </a>
            ) : (
              <span className="text-muted-foreground">{t('common.loading')}</span>
            )}
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="meeting-subject">{t('templates.subject')}</Label>
            <Input
              id="meeting-subject"
              value={draft?.subject ?? ''}
              disabled={!draft}
              onChange={(e) => setDraft((d) => d && { ...d, subject: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meeting-body">{t('templates.body')}</Label>
            <Textarea
              id="meeting-body"
              rows={10}
              value={draft?.body ?? ''}
              disabled={!draft}
              onChange={(e) => setDraft((d) => d && { ...d, body: e.target.value })}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={!draft || sending} onClick={send}>
            {sending ? t('email.sending') : t('meetings.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
