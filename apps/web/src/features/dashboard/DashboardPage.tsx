import { PIPELINE_STAGES, type Dashboard } from '@hrmit/shared'
import {
  Briefcase,
  CalendarClock,
  ClipboardList,
  Hourglass,
  LayoutDashboard,
  MailWarning,
  Users,
  UsersRound,
  Video,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { STAGE_STYLE, StageBadge } from '../pipeline/StageBadge.tsx'
import { Switch } from '@/components/ui/switch.tsx'
import { APP_ROOT } from '@/config.ts'
import { BlindContext, useBlind, useBlindSetting } from '../candidates/BlindContext.ts'
import { useScreen } from '../chat/ChatState.tsx'
import { candidateName } from '../candidates/candidateName.ts'

const STUCK_KEY = 'hrmit-stuckDays'
const DEFAULT_STUCK_DAYS = 7

const candidateLink = (jobId: number, candidateId: number) =>
  `${APP_ROOT}/recruitments/${jobId}/candidates/${candidateId}`

/**
 * What needs attention today, from GET /api/dashboard. No AI: every number is a plain query.
 * Every row links to the place where the work happens; blind screening applies here too.
 */
export function DashboardPage() {
  const { t } = useTranslation()
  const [blind, toggleBlind] = useBlindSetting()
  useScreen({ view: 'dashboard' })
  const [stuckDays, setStuckDays] = useState(
    () => Number(localStorage.getItem(STUCK_KEY)) || DEFAULT_STUCK_DAYS,
  )
  const dashboard = useApi(
    () =>
      api.api.dashboard.$get({ query: { stuckDays: String(stuckDays) } }).then((r) => {
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
    [stuckDays],
  )
  const changeStuckDays = (n: number) => {
    if (!Number.isInteger(n) || n < 1 || n > 365) return
    setStuckDays(n)
    localStorage.setItem(STUCK_KEY, String(n))
  }

  if (dashboard.error) return <p className="text-destructive">{t('common.error')}</p>
  const d = dashboard.data

  return (
    <BlindContext value={blind}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <LayoutDashboard className="size-5 text-primary" aria-hidden="true" />
          {t('dashboard.title')}
        </h2>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={blind} onCheckedChange={toggleBlind} />
          {t('candidates.blind')}
        </label>
      </div>
      {!d ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <>
          <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Count
              icon={Briefcase}
              n={d.counts.openJobs}
              label={t('dashboard.counts.openJobs')}
              to={`${APP_ROOT}/recruitments`}
            />
            <Count
              icon={Users}
              n={d.counts.activeCandidates}
              label={t('dashboard.counts.activeCandidates')}
              to={`${APP_ROOT}/recruitments`}
            />
            <Count
              icon={CalendarClock}
              n={d.counts.meetingsThisWeek}
              label={t('dashboard.counts.meetingsThisWeek')}
              to="#meetings"
            />
            <Count
              icon={UsersRound}
              n={d.counts.teams}
              label={t('dashboard.counts.teams')}
              to={`${APP_ROOT}/teams`}
            />
          </ul>
          <div className="grid gap-4 md:grid-cols-2">
            <Meetings rows={d.meetings} />
            <Stuck rows={d.stuck} days={stuckDays} onDays={changeStuckDays} />
            <MissingScores rows={d.missingScores} />
            <OpenJobs rows={d.openJobs} />
            <FailedEmails rows={d.failedEmails} />
          </div>
        </>
      )}
    </BlindContext>
  )
}

type Icon = typeof Briefcase

function Count({ icon: I, n, label, to }: { icon: Icon; n: number; label: string; to: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex h-full items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <I className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="grid">
          <span className="text-2xl leading-none font-semibold">{n}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </span>
      </Link>
    </li>
  )
}

function Tile({
  id,
  icon: I,
  title,
  aside,
  empty,
  children,
}: {
  id: string
  icon: Icon
  title: string
  aside?: ReactNode
  /** Shown instead of children when the list is empty. */
  empty: string | false
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`} // min-w-0: a grid item defaults to min-width auto, so a long nowrap line would widen the column.
      className="min-w-0 rounded-lg border bg-card p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${id}-title`} className="flex items-center gap-2 font-medium">
          <I className="size-4 text-primary" aria-hidden="true" />
          {title}
        </h3>
        {aside}
      </div>
      {empty ? <p className="text-sm text-muted-foreground">{empty}</p> : children}
    </section>
  )
}

/** One row of a list: the whole row is the link, with an optional action on the right. */
function Row({ to, children, action }: { to: string; children: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-2">
      <Link
        to={to}
        className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 rounded px-1 py-1 text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {children}
      </Link>
      {action}
    </li>
  )
}

const Name = ({ r }: { r: { candidateId: number; firstName: string; lastName: string } }) => {
  const { t } = useTranslation()
  const blind = useBlind()
  return <span className="font-medium">{candidateName({ id: r.candidateId, ...r }, blind, t)}</span>
}

function Meetings({ rows }: { rows: Dashboard['meetings'] }) {
  const { t, i18n } = useTranslation()
  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  return (
    <Tile
      id="meetings"
      icon={CalendarClock}
      title={t('dashboard.meetings.title')}
      empty={rows.length === 0 && t('dashboard.meetings.empty')}
    >
      <ul className="grid gap-1">
        {rows.map((m) => (
          <Row
            key={m.id}
            to={candidateLink(m.jobId, m.candidateId)}
            action={
              <a
                href={m.jitsiUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Video className="size-3.5" aria-hidden="true" />
                {t('dashboard.meetings.join')}
              </a>
            }
          >
            <time dateTime={m.startsAt} className="text-muted-foreground tabular-nums">
              {when(m.startsAt)}
            </time>
            <Name r={m} />
            <span className="text-muted-foreground">{m.jobTitle}</span>
          </Row>
        ))}
      </ul>
    </Tile>
  )
}

function Stuck({
  rows,
  days,
  onDays,
}: {
  rows: Dashboard['stuck']
  days: number
  onDays: (n: number) => void
}) {
  const { t } = useTranslation()
  // Typed text lives here, so the field can be emptied and retyped; only a valid number is applied.
  const [text, setText] = useState(String(days))
  return (
    <Tile
      id="stuck"
      icon={Hourglass}
      title={t('dashboard.stuck.title')}
      aside={
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          {t('dashboard.stuck.minDays')}
          <input
            type="number"
            min={1}
            max={365}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              onDays(e.target.valueAsNumber)
            }}
            onBlur={() => setText(String(days))}
            className="w-14 rounded-md border bg-background px-1.5 py-0.5 text-sm text-foreground"
          />
        </label>
      }
      empty={rows.length === 0 && t('dashboard.stuck.empty', { days })}
    >
      <ul className="grid gap-1">
        {rows.map((r) => (
          <Row key={r.candidateId} to={candidateLink(r.jobId, r.candidateId)}>
            <Name r={r} />
            <span className="text-muted-foreground">{r.jobTitle}</span>
            <StageBadge stage={r.stage} />
            <span className="ml-auto text-muted-foreground tabular-nums">
              {t('dashboard.stuck.days', { count: r.days })}
            </span>
          </Row>
        ))}
      </ul>
    </Tile>
  )
}

function MissingScores({ rows }: { rows: Dashboard['missingScores'] }) {
  const { t } = useTranslation()
  return (
    <Tile
      id="scores"
      icon={ClipboardList}
      title={t('dashboard.scores.title')}
      empty={rows.length === 0 && t('dashboard.scores.empty')}
    >
      <ul className="grid gap-1">
        {rows.map((r) => (
          <Row key={r.candidateId} to={candidateLink(r.jobId, r.candidateId)}>
            <Name r={r} />
            <span className="text-muted-foreground">{r.jobTitle}</span>
            <span className="ml-auto text-muted-foreground tabular-nums">
              {t('dashboard.scores.progress', { scored: r.scored, total: r.total })}
            </span>
          </Row>
        ))}
      </ul>
    </Tile>
  )
}

function OpenJobs({ rows }: { rows: Dashboard['openJobs'] }) {
  const { t } = useTranslation()
  return (
    <Tile
      id="jobs"
      icon={Briefcase}
      title={t('dashboard.jobs.title')}
      empty={rows.length === 0 && t('dashboard.jobs.empty')}
    >
      <ul className="grid gap-3">
        {rows.map((j) => {
          const total = Object.values(j.stages).reduce((a, b) => a + b, 0)
          const legend = PIPELINE_STAGES.map((s) => `${t(`stage.${s}`)} ${j.stages[s] ?? 0}`)
          return (
            <li key={j.id}>
              <Link
                to={`${APP_ROOT}/recruitments/${j.id}`}
                className="grid gap-1.5 rounded px-1 py-1 text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{j.title}</span>
                  {j.teamName && <span className="text-muted-foreground">{j.teamName}</span>}
                  <span className="ml-auto text-muted-foreground">
                    {t('recruitments.candidateCount', { count: total })}
                  </span>
                </span>
                {/* Segment widths follow the counts; numbers sit on the segments and the legend
                    names them, so the funnel never relies on color alone. */}
                {total > 0 && (
                  <span
                    className="flex h-6 overflow-hidden rounded border text-xs font-medium"
                    aria-hidden="true"
                  >
                    {PIPELINE_STAGES.filter((s) => (j.stages[s] ?? 0) > 0).map((s) => (
                      <span
                        key={s}
                        style={{ flexGrow: j.stages[s] }}
                        className={`flex min-w-6 items-center justify-center border-r last:border-r-0 ${STAGE_STYLE[s].tint}`}
                      >
                        {j.stages[s]}
                      </span>
                    ))}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{legend.join(' · ')}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Tile>
  )
}

function FailedEmails({ rows }: { rows: Dashboard['failedEmails'] }) {
  const { t, i18n } = useTranslation()
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language)
  return (
    <Tile
      id="failed"
      icon={MailWarning}
      title={t('dashboard.failed.title')}
      empty={rows.length === 0 && t('dashboard.failed.empty')}
    >
      <ul className="grid gap-1">
        {rows.map((f) => (
          <Row
            key={`${f.kind}-${f.id}`}
            to={
              f.kind === 'candidate'
                ? candidateLink(f.jobId!, f.targetId)
                : `${APP_ROOT}/employees?open=${f.targetId}`
            }
          >
            {/* One line: the subject gives way (ellipsis) before the badge or the date wrap. */}
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Badge variant="destructive">{t(`dashboard.failed.${f.kind}`)}</Badge>
              <span className="min-w-0 truncate font-medium">{f.subject}</span>
            </span>
            <time dateTime={f.sentAt} className="shrink-0 text-muted-foreground">
              {date(f.sentAt)}
            </time>
          </Row>
        ))}
      </ul>
      {rows.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{t('dashboard.failed.hint')}</p>
      )}
    </Tile>
  )
}
