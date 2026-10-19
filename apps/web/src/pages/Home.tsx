import { useTranslation } from 'react-i18next'
import { Link, Route, Routes } from 'react-router'
import { LanguageSwitch } from '../components/LanguageSwitch.tsx'
import { APP_PATH } from '../config.ts'
import { CandidatesPage } from '../features/candidates/CandidatesPage.tsx'
import { TemplatesPage } from '../features/email/TemplatesPage.tsx'
import { JobsPage } from '../features/jobs/JobsPage.tsx'
import { SettingsPage } from '../features/settings/SettingsPage.tsx'

// Header links are absolute from the mount point: a relative "settings" from /jobs/1 would
// resolve to /jobs/1/settings, which no route renders.
const root = APP_PATH.replace(/\/$/, '')

/** The app shell: header plus the feature routes, relative to wherever it is mounted. */
export function Home() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        {/* The only h1: every page gets a level-one heading (axe page-has-heading-one). */}
        <h1 className="text-2xl font-bold text-brand-dark">
          <Link to={`${root}/`}>HRmit</Link>
        </h1>
        <nav className="flex items-center gap-4 text-sm">
          <Link to={`${root}/`} className="hover:text-brand-dark">
            {t('nav.jobs')}
          </Link>
          <Link to={`${root}/templates`} className="hover:text-brand-dark">
            {t('nav.templates')}
          </Link>
          <Link to={`${root}/settings`} className="hover:text-brand-dark">
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
