import {
  AI_PROVIDERS,
  getProvider,
  isLocalProvider,
  type AiSettingsView,
  type AiTestResult,
} from '@hrmit/shared'
import { CheckIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { cn } from 'cn'
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
import { Switch } from '@/components/ui/switch.tsx'
import { ProviderLogo } from './ProviderLogo.tsx'

export function AiSettings() {
  const { t } = useTranslation()
  const loaded = useApi(() => api.api.settings.ai.$get().then((r) => r.json()), [])
  if (loaded.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!loaded.data) return <p className="text-muted-foreground">{t('common.loading')}</p>
  return <SettingsForm initial={loaded.data} />
}

type Form = { provider: string; baseUrl: string; model: string; chatEmployees: boolean }
/** A consent waiting for the user: what to run, and which endpoint the dialog names. */
type Pending = { run: () => void | Promise<void>; provider: string; baseUrl: string }

function SettingsForm({ initial }: { initial: AiSettingsView }) {
  const { t } = useTranslation()
  const [view, setView] = useState(initial)
  const [form, setForm] = useState<Form>({
    provider: initial.provider,
    baseUrl: initial.baseUrl,
    model: initial.model,
    chatEmployees: initial.chatEmployees,
  })
  const info = getProvider(form.provider)
  const local = isLocalProvider(form)
  // The key lives only in this input until it is sent; the server never echoes it back.
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'testing' | 'saved' | 'failed'>('idle')
  const [result, setResult] = useState<AiTestResult>()
  const [choosing, setChoosing] = useState(false)
  const [editUrl, setEditUrl] = useState(false)
  // ADR 0005: a cloud endpoint is opt-in. The action waits here until the user confirms; a
  // confirmed provider+URL pair is not asked about again before it is saved.
  const [pending, setPending] = useState<Pending | null>(null)
  const [consented, setConsented] = useState<string>()
  const consentKey = (f: Form) => `${f.provider} ${f.baseUrl}`
  const needsConsent =
    !local &&
    (form.provider !== view.provider || form.baseUrl !== view.baseUrl) &&
    consented !== consentKey(form)
  const guarded = (run: () => Promise<void>) =>
    needsConsent ? setPending({ run, ...form }) : run()
  const confirm = async () => {
    const p = pending
    setPending(null)
    if (!p) return
    setConsented(`${p.provider} ${p.baseUrl}`)
    await p.run()
  }
  const host = (() => {
    try {
      return new URL(pending?.baseUrl ?? form.baseUrl).host
    } catch {
      return pending?.baseUrl ?? form.baseUrl
    }
  })()

  // Installed Ollama models, when Ollama is the saved provider; otherwise the catalog list.
  const installed = useApi(
    () =>
      form.provider === 'ollama' && view.provider === 'ollama'
        ? api.api.ai.models.$get().then((r) => (r.ok ? r.json() : { models: [] }))
        : Promise.resolve({ models: [] }),
    [form.provider, view.provider],
  )
  const suggestions = installed.data?.models.length ? installed.data.models : info.models

  const choose = (id: string) => {
    setChoosing(false)
    const p = getProvider(id)
    const next: Form = {
      ...form,
      provider: id,
      baseUrl: id === 'custom' && form.provider === 'custom' ? form.baseUrl : p.baseUrl,
      model: p.models.length && !p.models.includes(form.model) ? p.models[0]! : form.model,
    }
    setEditUrl(false)
    if (!isLocalProvider(next) && id !== view.provider) {
      setPending({ run: () => setForm(next), ...next })
    } else setForm(next)
  }

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
  const urlEditable = local || info.id === 'custom' || editUrl
  const extLink = 'text-primary underline'

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-5">
      <h2 className="text-xl font-semibold">{t('settings.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('settings.privacy')}</p>

      <div className="grid gap-1.5">
        <span className="text-sm font-medium">{t('settings.provider')}</span>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setChoosing(true)}
          className="flex w-full items-center gap-3 rounded-lg border bg-card p-2 text-left transition-colors hover:border-brand focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ProviderLogo id={info.id} />
          <span className="sr-only">{t('settings.chooseProvider')}: </span>
          <span className="grid min-w-0 gap-0.5">
            <span className="flex items-center gap-2 font-medium">
              {info.name}
              <Badge variant="outline">{t(local ? 'ai.local' : 'ai.cloud')}</Badge>
            </span>
            <span className="truncate text-xs text-muted-foreground">{info.description}</span>
          </span>
        </button>
        {info.id === 'ollama' && (
          <p className="text-xs text-muted-foreground">
            {t('settings.ollamaHint')}{' '}
            <a href="https://ollama.com" target="_blank" rel="noreferrer" className={extLink}>
              ollama.com
            </a>
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="baseUrl">{t('settings.baseUrl')}</Label>
        <div className="flex gap-2">
          <Input
            id="baseUrl"
            type="url"
            required
            readOnly={!urlEditable}
            aria-readonly={!urlEditable}
            className={cn(!urlEditable && 'text-muted-foreground')}
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
          />
          {!urlEditable && (
            <Button type="button" variant="outline" onClick={() => setEditUrl(true)}>
              {t('common.edit')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="model">{t('settings.model')}</Label>
        <Input
          id="model"
          required
          list="model-suggestions"
          autoComplete="off"
          value={form.model}
          onChange={(e) => setForm({ ...form, model: e.target.value })}
        />
        <datalist id="model-suggestions">
          {suggestions.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <p className="text-xs text-muted-foreground">
          {t(
            installed.data?.models.length ? 'settings.installedModels' : 'settings.suggestedModels',
          )}
          {info.docsUrl && (
            <>
              {' '}
              <a href={info.docsUrl} target="_blank" rel="noreferrer" className={extLink}>
                {t('settings.modelDocs')}
              </a>
            </>
          )}
        </p>
      </div>

      {!local && (
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
          <p className="text-xs text-muted-foreground">
            {t('settings.keyHint')}
            {info.keyUrl && (
              <>
                {' '}
                <a href={info.keyUrl} target="_blank" rel="noreferrer" className={extLink}>
                  {t('settings.getKey')}
                </a>
              </>
            )}
          </p>
        </div>
      )}

      {!local && (
        <div className="grid gap-1.5 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="chatEmployees">{t('settings.chatEmployees.label')}</Label>
            <Switch
              id="chatEmployees"
              checked={form.chatEmployees}
              onCheckedChange={(chatEmployees) => setForm({ ...form, chatEmployees })}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.chatEmployees.hint')}</p>
        </div>
      )}

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
          className={result.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}
        >
          {result.ok
            ? t('settings.testOk', { model: result.model, ms: result.latencyMs })
            : t('settings.testFailed', { error: result.error })}
        </p>
      )}

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('settings.chooseProvider')}</DialogTitle>
            <DialogDescription>{t('settings.chooseProviderHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-2 overflow-y-auto">
            {AI_PROVIDERS.filter((p) => p.id === 'ollama').map((p) => (
              <ProviderOption
                key={p.id}
                id={p.id}
                selected={p.id === form.provider}
                onClick={() => choose(p.id)}
                className="border-brand/40 bg-brand/5"
              />
            ))}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AI_PROVIDERS.filter((p) => p.id !== 'ollama').map((p) => (
                <ProviderOption
                  key={p.id}
                  id={p.id}
                  selected={p.id === form.provider}
                  onClick={() => choose(p.id)}
                  stacked
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('settings.cloud.title', { provider: getProvider(pending?.provider ?? '').name })}
            </DialogTitle>
            <DialogDescription>{t('settings.cloud.endpoint', { host })}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <p className="font-medium">{t('settings.cloud.sent')}</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {(['cv', 'title', 'description', 'notes', 'employees'] as const).map((k) => (
                  <li key={k}>{t(`settings.cloud.sentFields.${k}`)}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium">{t('settings.cloud.never')}</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {(['name', 'email', 'phone', 'photo'] as const).map((k) => (
                  <li key={k}>{t(`settings.cloud.neverFields.${k}`)}</li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              <Link to=".." className={extLink}>
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

/** One provider in the chooser: a real button, marked when selected. */
function ProviderOption({
  id,
  selected,
  onClick,
  className,
  stacked = false,
}: {
  id: string
  selected: boolean
  onClick: () => void
  className?: string
  stacked?: boolean
}) {
  const { t } = useTranslation()
  const p = getProvider(id)
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-3 rounded-lg border bg-card p-2 text-left transition-colors hover:border-brand focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:border-brand aria-pressed:ring-2 aria-pressed:ring-brand/40',
        stacked && 'flex-col text-center',
        className,
      )}
    >
      {selected && (
        <CheckIcon aria-hidden className="absolute top-1.5 right-1.5 size-4 text-primary" />
      )}
      <ProviderLogo id={p.id} />
      <span className="grid min-w-0 gap-0.5">
        <span
          className={cn(
            'flex flex-wrap items-center gap-1 text-sm font-medium',
            stacked && 'justify-center',
          )}
        >
          {p.name}
          {p.local && <Badge variant="outline">{t('ai.local')}</Badge>}
        </span>
        <span className="text-xs text-muted-foreground">{p.description}</span>
      </span>
    </button>
  )
}
