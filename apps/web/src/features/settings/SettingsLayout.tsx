import { useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { cn } from '@/lib/utils.ts'

export const SETTINGS_TABS = ['general', 'ai', 'email', 'templates', 'backup'] as const

/**
 * /settings/<tab>: a WAI-ARIA vertical tab list on the left, the tab's route on the right.
 * Roving tabindex: Tab lands on the selected tab, arrows move and activate, Home/End jump.
 */
export function SettingsLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const current = useLocation().pathname.split('/').pop()
  const selected = Math.max(
    0,
    SETTINGS_TABS.findIndex((tab) => tab === current),
  )
  const refs = useRef<(HTMLAnchorElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent) => {
    // From the focused tab, not from `selected`: navigation re-renders in a transition,
    // so a quick second key press would otherwise read a stale index.
    const from = refs.current.indexOf(e.target as HTMLAnchorElement)
    if (from < 0) return
    const last = SETTINGS_TABS.length - 1
    const next =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? (from + 1) % SETTINGS_TABS.length
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? (from + last) % SETTINGS_TABS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : -1
    const tab = SETTINGS_TABS[next]
    if (!tab) return
    e.preventDefault()
    navigate(tab)
    refs.current[next]?.focus()
  }

  return (
    <div className="grid gap-6 md:grid-cols-[12rem_1fr]">
      <nav
        role="tablist"
        aria-orientation="vertical"
        aria-label={t('settings.sections')}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b pb-2 md:flex-col md:border-r md:border-b-0 md:pr-4 md:pb-0"
      >
        {SETTINGS_TABS.map((tab, i) => (
          <Link
            key={tab}
            to={tab}
            role="tab"
            id={`settings-tab-${tab}`}
            aria-selected={i === selected}
            aria-controls="settings-panel"
            tabIndex={i === selected ? 0 : -1}
            ref={(el) => {
              refs.current[i] = el
            }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none',
              i === selected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {t(`settings.tabs.${tab}`)}
          </Link>
        ))}
      </nav>
      <div
        role="tabpanel"
        id="settings-panel"
        aria-labelledby={`settings-tab-${SETTINGS_TABS[selected]}`}
        className="min-w-0"
      >
        <Outlet />
      </div>
    </div>
  )
}
