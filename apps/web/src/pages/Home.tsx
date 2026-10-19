import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Health } from '@hrmit/shared'
import { api } from '../api/client.ts'
import { LanguageSwitch } from '../components/LanguageSwitch.tsx'

export function Home() {
  const { t } = useTranslation()
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    api.api.health
      .$get()
      .then((r) => r.json())
      .then(setHealth)
  }, [])

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-dark">HRmit</h1>
        <LanguageSwitch />
      </header>
      <p className="mt-2 text-ink/80">{t('tagline')}</p>
      <p className="mt-6 text-sm">
        {health
          ? t('health.ok', { mode: health.mode, version: health.version })
          : t('health.loading')}
      </p>
    </main>
  )
}
