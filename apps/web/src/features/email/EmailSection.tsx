import { type Candidate, type Email, type SendEmailInput } from '@hrmit/shared'
import { Send } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { IS_DEMO } from '@/config.ts'
import { useBlind } from '../candidates/BlindContext.ts'
import { useTemplateLabel } from '../settings/TemplatesSettings.tsx'

const BADGE: Record<Email['status'], 'default' | 'destructive' | 'secondary'> = {
  sent: 'default',
  failed: 'destructive',
  demo: 'secondary',
}

/** Communication history (docs/ARCHITECTURE.md §6) and the door to the send dialog. */
export function EmailSection({ candidate }: { candidate: Candidate }) {
  const { t, i18n } = useTranslation()
  const blind = useBlind()
  const [open, setOpen] = useState(false)
  const param = { id: String(candidate.id) }
  const history = useApi(
    () =>
      api.api.candidates[':id'].emails.$get({ param }).then(async (r) => {
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
    [candidate.id],
  )

  if (blind) return <p className="text-sm text-muted-foreground italic">{t('email.hidden')}</p>
  if (history.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!history.data) return <p className="text-muted-foreground">{t('common.loading')}</p>

  return (
    <div className="grid gap-3">
      {history.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('email.none')}</p>
      ) : (
        <ul className="grid gap-2 overflow-hidden">
          {history.data.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">{e.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.sentAt).toLocaleString(i18n.language)}
                  {e.error && <span className="text-destructive"> · {e.error}</span>}
                </p>
              </div>
              <Badge variant={BADGE[e.status]}>{t(`email.status.${e.status}`)}</Badge>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Send data-icon="inline-start" /> {t('email.send')}
        </Button>
      </div>
      {open && (
        <SendEmailDialog
          candidate={candidate}
          onClose={() => setOpen(false)}
          onSent={(e) => {
            history.setData((list) => [...list, e])
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

type DialogProps = { candidate: Candidate; onClose: () => void; onSent: (e: Email) => void }

/** Template pick, then the rendered text is editable: what is sent is exactly what is shown. */
function SendEmailDialog({ candidate, onClose, onSent }: DialogProps) {
  const { t } = useTranslation()
  const label = useTemplateLabel()
  const [templateKey, setTemplateKey] = useState('invite')
  // Built-in and custom templates alike; the list is short, so it is fetched when the dialog opens.
  const templates = useApi(() => api.api.templates.$get().then((r) => r.json()), [])
  const [draft, setDraft] = useState<SendEmailInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const param = { id: String(candidate.id) }

  useEffect(() => {
    let live = true
    setDraft(null)
    api.api.candidates[':id'].emails.preview
      .$get({ param, query: { template: templateKey } })
      .then(async (r) => {
        if (live && r.status === 200) setDraft(await r.json())
      })
    return () => {
      live = false
    }
  }, [candidate.id, templateKey])

  const send = async () => {
    if (!draft) return
    setSending(true)
    setError(null)
    const res = await api.api.candidates[':id'].emails.$post({ param, json: draft })
    setSending(false)
    if (res.status === 201) return onSent(await res.json())
    setError(res.status === 409 ? t('email.notConfigured') : t('form.saveFailed'))
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('email.dialogTitle', { email: candidate.email })}</DialogTitle>
          <DialogDescription>{IS_DEMO ? t('email.demoHint') : t('email.hint')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="email-template">{t('email.template')}</Label>
            <select
              id="email-template"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="h-8 rounded-lg border bg-background px-2 text-sm"
            >
              {(templates.data ?? []).map((x) => (
                <option key={x.key} value={x.key}>
                  {label.name(x)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email-subject">{t('templates.subject')}</Label>
            <Input
              id="email-subject"
              value={draft?.subject ?? ''}
              disabled={!draft}
              onChange={(e) => setDraft((d) => d && { ...d, subject: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email-body">{t('templates.body')}</Label>
            <Textarea
              id="email-body"
              rows={12}
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
            {sending ? t('email.sending') : t('email.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
