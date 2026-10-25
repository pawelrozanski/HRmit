import { useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { cn } from '@/lib/utils.ts'

export const SETTINGS_TABS = ['general', 'ai', 'prompts', 'email', 'templates', 'backup'] as const
type Tab = (typeof SETTINGS_TABS)[number]

/** One tab list per group (0.5.4); General stands alone. Arrow keys still walk all of them. */
const GROUPS: { key: 'general' | 'ai' | 'mail' | 'files'; tabs: Tab[] }[] = [
  { key: 'general', tabs: ['general'] },
  { key: 'ai', tabs: ['ai', 'prompts'] },
  { key: 'mail', tabs: ['email', 'templates'] },
  { key: 'files', tabs: ['backup'] },
]

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
        aria-label={t('settings.sections')}
        onKeyDown={onKeyDown}
        className="flex gap-4 overflow-x-auto border-b pb-2 md:flex-col md:gap-5 md:border-r md:border-b-0 md:pr-4 md:pb-0"
      >
        {GROUPS.map((group) => (
          <div key={group.key} className="flex shrink-0 gap-1 md:flex-col">
            {group.key !== 'general' && (
              <span
                id={`settings-group-${group.key}`}
                className="px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:border-t md:pt-3"
              >
                {t(`settings.groups.${group.key}`)}
              </span>
            )}
            <div
              role="tablist"
              aria-orientation="vertical"
              aria-labelledby={group.key === 'general' ? undefined : `settings-group-${group.key}`}
              aria-label={group.key === 'general' ? t('settings.tabs.general') : undefined}
              className="flex gap-1 md:flex-col"
            >
              {group.tabs.map((tab) => {
                const i = SETTINGS_TABS.indexOf(tab)
                return (
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
                )
              })}
            </div>
          </div>
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
