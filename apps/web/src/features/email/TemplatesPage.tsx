import { EMAIL_TEMPLATE_KEYS, type EmailTemplate } from '@hrmit/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'

const PLACEHOLDERS = ['firstName', 'lastName', 'jobTitle', 'companyName', 'startsAt', 'jitsiUrl']

/** One form per template key. Save PUTs all three; the server replaces subject and body per key. */
export function TemplatesPage() {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<EmailTemplate[] | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const loaded = useApi(
    () =>
      api.api.templates.$get().then(async (r) => {
        const list = await r.json()
        setDraft(list)
        return list
      }),
    [],
  )

  const edit = (key: EmailTemplate['key'], patch: Partial<EmailTemplate>) => {
    setDraft((list) => list && list.map((x) => (x.key === key ? { ...x, ...patch } : x)))
    setStatus('idle')
  }

  const save = async () => {
    if (!draft) return
    setStatus('saving')
    const res = await api.api.templates.$put({ json: draft })
    if (res.status !== 200) return setStatus('failed')
    setDraft(await res.json())
    setStatus('saved')
  }

  if (loaded.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!draft) return <p className="text-muted-foreground">{t('common.loading')}</p>

  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <h2 className="text-xl font-semibold">{t('templates.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('templates.intro')}</p>
        <p className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          {PLACEHOLDERS.map((p) => (
            <code key={p} className="rounded bg-white px-1.5 py-0.5 text-ink">
              {`{{${p}}}`}
            </code>
          ))}
        </p>
      </div>
      {EMAIL_TEMPLATE_KEYS.map((key) => {
        const row = draft.find((x) => x.key === key)
        if (!row) return null
        return (
          <section key={key} className="grid gap-3 rounded-lg border bg-white p-4">
            <h3 className="font-semibold text-brand-dark">{t(`templates.keys.${key}`)}</h3>
            <div className="grid gap-1.5">
              <Label htmlFor={`${key}-subject`}>{t('templates.subject')}</Label>
              <Input
                id={`${key}-subject`}
                required
                value={row.subject}
                onChange={(e) => edit(key, { subject: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${key}-body`}>{t('templates.body')}</Label>
              <Textarea
                id={`${key}-body`}
                required
                rows={10}
                value={row.body}
                onChange={(e) => edit(key, { body: e.target.value })}
              />
            </div>
          </section>
        )
      })}
      <div className="flex items-center gap-3">
        <Button disabled={status === 'saving'} onClick={save}>
          {t('common.save')}
        </Button>
        {status === 'saved' && (
          <span className="text-sm text-muted-foreground">{t('settings.saved')}</span>
        )}
        {status === 'failed' && (
          <span role="alert" className="text-sm text-destructive">
            {t('form.saveFailed')}
          </span>
        )}
      </div>
    </div>
  )
}
