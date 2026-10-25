import { Power } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Button } from '@/components/ui/button.tsx'
import { Label } from '@/components/ui/label.tsx'
import { IS_DEMO } from '@/config.ts'
import { readTheme, setTheme, THEMES } from '@/theme.ts'
import { UpdateDialog } from './UpdateDialog.tsx'

const REPO = 'https://github.com/pawelrozanski/HRmit'
const LANGS = ['en', 'pl'] as const
const select = 'h-8 w-fit rounded-lg border bg-background px-2 text-sm'

/** Language and theme live in localStorage (no server round trip); the version comes from /api/health. */
export function GeneralSettings() {
  const { t, i18n } = useTranslation()
  const [theme, setThemeState] = useState(readTheme)
  const health = useApi(() => api.api.health.$get().then((r) => r.json()), [])

  return (
    <div className="grid max-w-xl gap-6">
      <h2 className="text-xl font-semibold">{t('settings.tabs.general')}</h2>

      <div className="grid gap-1.5">
        <Label htmlFor="language">{t('settings.language')}</Label>
        <select
          id="language"
          value={i18n.resolvedLanguage}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className={select}
        >
          {LANGS.map((lng) => (
            <option key={lng} value={lng}>
              {t(`settings.languages.${lng}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="theme">{t('settings.theme')}</Label>
        <select
          id="theme"
          value={theme}
          onChange={(e) => {
            const next = THEMES.find((x) => x === e.target.value) ?? 'system'
            setTheme(next)
            setThemeState(next)
          }}
          className={select}
        >
          {THEMES.map((x) => (
            <option key={x} value={x}>
              {t(`settings.themes.${x}`)}
            </option>
          ))}
        </select>
      </div>

      <section className="grid gap-1 rounded-lg border bg-card p-4 text-sm">
        <h3 className="font-semibold text-primary">{t('settings.about')}</h3>
        <p className="text-muted-foreground">{t('tagline')}</p>
        <p>
          {health.data
            ? t('settings.version', { version: health.data.version, mode: health.data.mode })
            : health.error
              ? t('common.error')
              : t('common.loading')}
        </p>
        <p className="flex gap-3">
          <a href={`${REPO}/blob/main/CHANGELOG.md`} className="text-primary underline">
            {t('settings.changelog')}
          </a>
          <a href={REPO} className="text-primary underline">
            GitHub
          </a>
          <a href={`${REPO}/blob/main/LICENSE`} className="text-primary underline">
            {t('settings.license')}
          </a>
        </p>
        {!IS_DEMO && <UpdateDialog />}
      </section>

      {!IS_DEMO && <Shutdown />}
    </div>
  )
}

/**
 * Stops the server on this computer. The page stays up (static files are already loaded) and
 * says so; starting HRmit again is done where it was started from.
 */
function Shutdown() {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'working' | 'off' | 'failed'>('idle')

  const shutdown = async () => {
    if (!window.confirm(t('settings.shutdown.confirm'))) return
    setState('working')
    try {
      const res = await api.api.shutdown.$post()
      setState(res.status === 200 ? 'off' : 'failed')
    } catch {
      setState('failed')
    }
  }

  return (
    <section className="grid gap-2 rounded-lg border bg-card p-4 text-sm">
      <h3 className="font-semibold text-primary">{t('settings.shutdown.title')}</h3>
      <p className="text-muted-foreground">{t('settings.shutdown.hint')}</p>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="destructive"
          disabled={state !== 'idle' && state !== 'failed'}
          onClick={shutdown}
        >
          <Power data-icon="inline-start" />
          {state === 'working' ? t('settings.shutdown.working') : t('settings.shutdown.button')}
        </Button>
        {state === 'off' && <span role="status">{t('settings.shutdown.done')}</span>}
        {state === 'failed' && (
          <span role="alert" className="text-destructive">
            {t('common.error')}
          </span>
        )}
      </div>
    </section>
  )
}
