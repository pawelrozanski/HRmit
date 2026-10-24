import {
  Briefcase,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Route, Routes, useParams } from 'react-router'
import { Mark, Wordmark } from '../components/Brand.tsx'
import { APP_ROOT as root } from '../config.ts'
import { DashboardPage } from '../features/dashboard/DashboardPage.tsx'
import { ChatPanel } from '../features/chat/ChatPanel.tsx'
import { ChatProvider, useChat } from '../features/chat/ChatState.tsx'
import { CandidatesPage } from '../features/candidates/CandidatesPage.tsx'
import { EmployeesPage } from '../features/employees/EmployeesPage.tsx'
import { RecruitmentsPage } from '../features/recruitments/RecruitmentsPage.tsx'
import { AiSettings } from '../features/settings/AiSettings.tsx'
import { GeneralSettings } from '../features/settings/GeneralSettings.tsx'
import { SettingsLayout } from '../features/settings/SettingsLayout.tsx'
import { SmtpSettings } from '../features/settings/SmtpSettings.tsx'
import { TemplatesSettings } from '../features/settings/TemplatesSettings.tsx'
import { TeamPage } from '../features/teams/TeamPage.tsx'
import { TeamsPage } from '../features/teams/TeamsPage.tsx'

// Header links are absolute from the mount point: a relative "settings" from /recruitments/1
// would resolve to /recruitments/1/settings, which no route renders.
const navLink =
  'flex items-center gap-1.5 rounded px-1 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:font-semibold aria-[current=page]:text-primary [&>svg]:size-4'

/** 0.2 linked /jobs/:id; the entity is still a job in the API, a recruitment in the UI. */
function JobRedirect() {
  const { id } = useParams()
  return <Navigate to={`${root}/recruitments/${id}`} replace />
}

/** Opens the assistant panel; lives in the header so it is one click away on every page. */
function ChatButton() {
  const { t } = useTranslation()
  const { open, setOpen } = useChat()
  return (
    <button type="button" onClick={() => setOpen(true)} aria-expanded={open} className={navLink}>
      <MessageSquare aria-hidden="true" />
      {t('chat.title')}
    </button>
  )
}

/** The app shell: header plus the feature routes, relative to wherever it is mounted. */
export function Home() {
  return (
    <ChatProvider>
      <Shell />
      <ChatPanel />
    </ChatProvider>
  )
}

function Shell() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {/* The only h1: every page gets a level-one heading (axe page-has-heading-one). */}
        <h1 className="text-2xl">
          <Link to={`${root}/`} className="flex items-center gap-2">
            <Mark className="h-9 w-auto" />
            <Wordmark />
          </Link>
        </h1>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <NavLink to={`${root}/dashboard`} className={navLink}>
            <LayoutDashboard aria-hidden="true" />
            {t('nav.dashboard')}
          </NavLink>
          <ChatButton />
          <NavLink to={`${root}/recruitments`} className={navLink}>
            <Briefcase aria-hidden="true" />
            {t('nav.recruitments')}
          </NavLink>
          <NavLink to={`${root}/employees`} className={navLink}>
            <Users aria-hidden="true" />
            {t('nav.employees')}
          </NavLink>
          <NavLink to={`${root}/teams`} className={navLink}>
            <UsersRound aria-hidden="true" />
            {t('nav.teams')}
          </NavLink>
          <NavLink to={`${root}/settings`} className={navLink}>
            <Settings aria-hidden="true" />
            {t('nav.settings')}
          </NavLink>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="outline-none">
        <Routes>
          <Route index element={<Navigate to={`${root}/dashboard`} replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="recruitments" element={<RecruitmentsPage />} />
          <Route path="recruitments/:id" element={<CandidatesPage />} />
          <Route path="jobs/:id" element={<JobRedirect />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="teams/:id" element={<TeamPage />} />
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
