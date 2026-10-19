import {
  aiProviderSchema,
  isLocalProvider,
  type AiProvider,
  type AiSettingsView,
  type AiTestResult,
} from '@hrmit/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
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

/** Suggested endpoint per provider; swapped in when the user has not customized the URL. */
const DEFAULT_URL: Record<AiProvider, string> = {
  ollama: 'http://localhost:11434/v1',
  anthropic: 'https://api.anthropic.com/v1',
  'openai-compatible': 'https://api.openai.com/v1',
}

export function SettingsPage() {
  const { t } = useTranslation()
  const loaded = useApi(() => api.api.settings.ai.$get().then((r) => r.json()), [])
  if (loaded.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!loaded.data) return <p className="text-muted-foreground">{t('common.loading')}</p>
  return <SettingsForm initial={loaded.data} />
}

function SettingsForm({ initial }: { initial: AiSettingsView }) {
  const { t } = useTranslation()
  const [view, setView] = useState(initial)
  const [form, setForm] = useState({
    provider: initial.provider,
    baseUrl: initial.baseUrl,
    model: initial.model,
  })
  // The key lives only in this input until it is sent; the server never echoes it back.
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'testing' | 'saved' | 'failed'>('idle')
  const [result, setResult] = useState<AiTestResult>()
  // ADR 0005: a cloud endpoint is opt-in. The action waits here until the user confirms.
  const [pending, setPending] = useState<(() => Promise<void>) | null>(null)
  const needsConsent =
    !isLocalProvider(form) && (form.provider !== view.provider || form.baseUrl !== view.baseUrl)
  const guarded = (run: () => Promise<void>) => (needsConsent ? setPending(() => run) : run())
  const confirm = async () => {
    const run = pending
    setPending(null)
    await run?.()
  }
  const host = (() => {
    try {
      return new URL(form.baseUrl).host
    } catch {
      return form.baseUrl
    }
  })()

  const changeProvider = (provider: AiProvider) =>
    setForm((f) => ({
      ...f,
      provider,
      baseUrl: f.baseUrl === DEFAULT_URL[f.provider] ? DEFAULT_URL[provider] : f.baseUrl,
    }))

  const save = async (key: string | null | undefined) => {
    setStatus('saving')
    setResult(undefined)
    const res = await api.api.settings.ai.$put({ json: { ...form, apiKey: key } })
    if (res.status !== 200) {
      setStatus('failed')
      return false
    }
    setView(await res.json())
    setApiKey('')
    setStatus('saved')
    return true
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    guarded(async () => {
      await save(apiKey || undefined)
    })
  }

  // Tests what the server has, so unsaved edits are saved first.
  const test = () =>
    guarded(async () => {
      if (!(await save(apiKey || undefined))) return
      setStatus('testing')
      const res = await api.api.ai.test.$post()
      setResult(await res.json())
      setStatus('idle')
    })

  const busy = status === 'saving' || status === 'testing'

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-5">
      <h2 className="text-xl font-semibold">{t('settings.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('settings.privacy')}</p>

      <div className="grid gap-1.5">
        <Label htmlFor="provider">{t('settings.provider')}</Label>
        <select
          id="provider"
          value={form.provider}
          onChange={(e) => changeProvider(aiProviderSchema.parse(e.target.value))}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          {aiProviderSchema.options.map((p) => (
            <option key={p} value={p}>
              {t(`settings.providers.${p}`)}
            </option>
          ))}
        </select>
        {form.provider === 'ollama' && (
          <p className="text-xs text-muted-foreground">
            {t('settings.ollamaHint')}{' '}
            <a
              href="https://ollama.com"
              target="_blank"
              rel="noreferrer"
              className="text-brand-dark underline"
            >
              ollama.com
            </a>
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="baseUrl">{t('settings.baseUrl')}</Label>
        <Input
          id="baseUrl"
          type="url"
          required
          value={form.baseUrl}
          onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="model">{t('settings.model')}</Label>
        <Input
          id="model"
          required
          value={form.model}
          onChange={(e) => setForm({ ...form, model: e.target.value })}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="apiKey">{t('settings.apiKey')}</Label>
        <div className="flex gap-2">
          <Input
            id="apiKey"
            type="password"
            autoComplete="off"
            value={apiKey}
            placeholder={view.hasApiKey ? t('settings.keyStored') : t('settings.keyPlaceholder')}
            onChange={(e) => setApiKey(e.target.value)}
          />
          {view.hasApiKey && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => save(null)}>
              {t('settings.removeKey')}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t('settings.keyHint')}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy}>
          {t('common.save')}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={test}>
          {status === 'testing' ? t('settings.testing') : t('settings.test')}
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
            ? t('settings.testOk', { model: result.model, ms: result.latencyMs })
            : t('settings.testFailed', { error: result.error })}
        </p>
      )}

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('settings.cloud.title', { provider: t(`settings.providers.${form.provider}`) })}
            </DialogTitle>
            <DialogDescription>{t('settings.cloud.endpoint', { host })}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <p className="font-medium">{t('settings.cloud.sent')}</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {(['cv', 'title', 'description'] as const).map((k) => (
                  <li key={k}>{t(`settings.cloud.sentFields.${k}`)}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium">{t('settings.cloud.never')}</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {(['name', 'email', 'phone', 'notes', 'photo'] as const).map((k) => (
                  <li key={k}>{t(`settings.cloud.neverFields.${k}`)}</li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              <Link to=".." className="text-brand-dark underline">
                {t('settings.cloud.previewLink')}
              </Link>{' '}
              {t('settings.cloud.previewHint')}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPending(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={confirm}>
              {t('settings.cloud.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
