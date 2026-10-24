import {
  AI_PROMPT_DEFAULTS,
  AI_PROMPT_KEYS,
  AI_PROMPT_PLACEHOLDERS,
  type AiPrompts,
} from '@hrmit/shared'
import { RotateCcw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Button } from '@/components/ui/button.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'

/**
 * The instruction text of every prompt (0.5.2). The shipped defaults keep the product rule
 * (describe, never judge); editing them is the operator's own call and responsibility.
 */
export function PromptsSettings() {
  const { t } = useTranslation()
  const loaded = useApi(() => api.api.settings.prompts.$get().then((r) => r.json()), [])
  if (loaded.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!loaded.data) return <p className="text-muted-foreground">{t('common.loading')}</p>
  return <PromptsForm initial={loaded.data} />
}

function PromptsForm({ initial }: { initial: AiPrompts }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const set = (k: keyof AiPrompts, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setStatus('idle')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (AI_PROMPT_KEYS.some((k) => !form[k].trim())) return setStatus('failed')
    setStatus('saving')
    const res = await api.api.settings.prompts.$put({ json: form })
    if (res.status !== 200) return setStatus('failed')
    setForm(await res.json())
    setStatus('saved')
  }

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-5">
      <div>
        <h2 className="text-xl font-semibold">{t('prompts.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('prompts.intro')}</p>
      </div>
      {AI_PROMPT_KEYS.map((k) => (
        <div key={k} className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`prompt-${k}`}>{t(`prompts.keys.${k}`)}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={form[k] === AI_PROMPT_DEFAULTS[k]}
              onClick={() => set(k, AI_PROMPT_DEFAULTS[k])}
            >
              <RotateCcw data-icon="inline-start" /> {t('templates.restore')}
            </Button>
          </div>
          <Textarea
            id={`prompt-${k}`}
            rows={k === 'chat' ? 14 : 6}
            value={form[k]}
            onChange={(e) => set(k, e.target.value)}
            className="font-mono text-xs"
          />
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {t('templates.placeholders')}
            {AI_PROMPT_PLACEHOLDERS[k].map((p) => (
              <code key={p} className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                {`{{${p}}}`}
              </code>
            ))}
          </p>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={status === 'saving'}>
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
    </form>
  )
}
