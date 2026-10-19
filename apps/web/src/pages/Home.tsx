import { useTranslation } from 'react-i18next'
import { Link, Route, Routes } from 'react-router'
import { LanguageSwitch } from '../components/LanguageSwitch.tsx'
import { CandidatesPage } from '../features/candidates/CandidatesPage.tsx'
import { TemplatesPage } from '../features/email/TemplatesPage.tsx'
import { JobsPage } from '../features/jobs/JobsPage.tsx'
import { SettingsPage } from '../features/settings/SettingsPage.tsx'

/** The app shell: header plus the feature routes, relative to wherever it is mounted. */
export function Home() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <Link to="." className="text-2xl font-bold text-brand-dark">
          HRmit
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="." className="hover:text-brand-dark">
            {t('nav.jobs')}
          </Link>
          <Link to="templates" className="hover:text-brand-dark">
            {t('nav.templates')}
          </Link>
          <Link to="settings" className="hover:text-brand-dark">
            {t('nav.settings')}
          </Link>
          <LanguageSwitch />
        </nav>
      </header>
      <Routes>
        <Route index element={<JobsPage />} />
        <Route path="jobs/:id" element={<CandidatesPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Routes>
    </main>
  )
}
