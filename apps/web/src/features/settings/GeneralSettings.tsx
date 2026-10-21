import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Label } from '@/components/ui/label.tsx'
import { readTheme, setTheme, THEMES } from '@/theme.ts'

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
        </p>
      </section>
    </div>
  )
}
