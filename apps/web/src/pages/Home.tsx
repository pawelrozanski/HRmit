import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Route, Routes } from 'react-router'
import { APP_PATH } from '../config.ts'
import { CandidatesPage } from '../features/candidates/CandidatesPage.tsx'
import { JobsPage } from '../features/jobs/JobsPage.tsx'
import { AiSettings } from '../features/settings/AiSettings.tsx'
import { GeneralSettings } from '../features/settings/GeneralSettings.tsx'
import { SettingsLayout } from '../features/settings/SettingsLayout.tsx'
import { SmtpSettings } from '../features/settings/SmtpSettings.tsx'
import { TemplatesSettings } from '../features/settings/TemplatesSettings.tsx'

// Header links are absolute from the mount point: a relative "settings" from /jobs/1 would
// resolve to /jobs/1/settings, which no route renders.
const root = APP_PATH.replace(/\/$/, '')

const navLink =
  'rounded px-1 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:font-semibold aria-[current=page]:text-primary'

/** The app shell: header plus the feature routes, relative to wherever it is mounted. */
export function Home() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        {/* The only h1: every page gets a level-one heading (axe page-has-heading-one). */}
        <h1 className="text-2xl font-bold text-primary">
          <Link to={`${root}/`}>HRmit</Link>
        </h1>
        <nav className="flex items-center gap-4 text-sm">
          <NavLink to={`${root}/`} end className={navLink}>
            {t('nav.jobs')}
          </NavLink>
          <NavLink to={`${root}/settings`} className={navLink}>
            {t('nav.settings')}
          </NavLink>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="outline-none">
        <Routes>
          <Route index element={<JobsPage />} />
          <Route path="jobs/:id" element={<CandidatesPage />} />
          <Route
            path="templates"
            element={<Navigate to={`${root}/settings/templates`} replace />}
          />
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={<GeneralSettings />} />
            <Route path="ai" element={<AiSettings />} />
            <Route path="email" element={<SmtpSettings />} />
            <Route path="templates" element={<TemplatesSettings />} />
          </Route>
        </Routes>
      </main>
    </div>
  )
}
