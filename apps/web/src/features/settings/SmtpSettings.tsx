import type { SmtpSettingsView, SmtpTestResult } from '@hrmit/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'

export function SmtpSettings() {
  const { t } = useTranslation()
  const loaded = useApi(() => api.api.settings.smtp.$get().then((r) => r.json()), [])
  if (loaded.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!loaded.data) return <p className="text-muted-foreground">{t('common.loading')}</p>
  return <SmtpForm initial={loaded.data} />
}

/** Same password handling as the AI key: typed here, sent once, never echoed back. */
function SmtpForm({ initial }: { initial: SmtpSettingsView }) {
  const { t } = useTranslation()
  const [view, setView] = useState(initial)
  const [form, setForm] = useState({
    host: initial.host,
    port: initial.port,
    secure: initial.secure,
    user: initial.user,
    from: initial.from,
    companyName: initial.companyName,
  })
  const [pass, setPass] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'testing' | 'saved' | 'failed'>('idle')
  const [result, setResult] = useState<SmtpTestResult>()
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const save = async (p: string | null | undefined) => {
    setStatus('saving')
    setResult(undefined)
    const res = await api.api.settings.smtp.$put({ json: { ...form, pass: p } })
    if (res.status !== 200) {
      setStatus('failed')
      return false
    }
    setView(await res.json())
    setPass('')
    setStatus('saved')
    return true
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await save(pass || undefined)
  }

  // Tests what the server has, so unsaved edits are saved first.
  const test = async () => {
    if (!(await save(pass || undefined))) return
    setStatus('testing')
    const res = await api.api.settings.smtp.test.$post()
    setResult(await res.json())
    setStatus('idle')
  }

  const busy = status === 'saving' || status === 'testing'
  const field = (key: 'host' | 'user' | 'from' | 'companyName', type = 'text') => (
    <div className="grid gap-1.5">
      <Label htmlFor={`smtp-${key}`}>{t(`smtp.${key}`)}</Label>
      <Input
        id={`smtp-${key}`}
        type={type}
        required={key === 'host' || key === 'from'}
        value={form[key]}
        onChange={(e) => set({ [key]: e.target.value })}
      />
    </div>
  )

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-5">
      <h2 className="text-xl font-semibold">{t('smtp.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('smtp.privacy')}</p>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        {field('host')}
        <div className="grid gap-1.5">
          <Label htmlFor="smtp-port">{t('smtp.port')}</Label>
          <Input
            id="smtp-port"
            type="number"
            min={1}
            max={65535}
            required
            value={form.port}
            onChange={(e) => set({ port: Number(e.target.value) })}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.secure}
          onChange={(e) => set({ secure: e.target.checked })}
        />
        {t('smtp.secure')}
      </label>
      {field('user')}
      <div className="grid gap-1.5">
        <Label htmlFor="smtp-pass">{t('smtp.pass')}</Label>
        <div className="flex gap-2">
          <Input
            id="smtp-pass"
            type="password"
            autoComplete="off"
            value={pass}
            placeholder={view.hasPass ? t('smtp.passStored') : ''}
            onChange={(e) => setPass(e.target.value)}
          />
          {view.hasPass && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => save(null)}>
              {t('smtp.removePass')}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t('settings.keyHint')}</p>
      </div>
      {field('from', 'email')}
      {field('companyName')}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy}>
          {t('common.save')}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={test}>
          {status === 'testing' ? t('smtp.testing') : t('smtp.test')}
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
      {result && (
        <p
          role="status"
          className={result.ok ? 'text-sm text-brand-dark' : 'text-sm text-destructive'}
        >
          {result.ok
            ? t('smtp.testOk', { from: form.from })
            : t('smtp.testFailed', { error: result.error })}
        </p>
      )}
    </form>
  )
}
