import type { Job } from '@hrmit/shared'
import { Briefcase, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { APP_ROOT } from '@/config.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Label } from '@/components/ui/label.tsx'
import { RecruitmentForm, selectClass } from './RecruitmentForm.tsx'

export function RecruitmentsPage() {
  const { t } = useTranslation()
  const jobs = useApi(() => api.api.jobs.$get({ query: {} }).then((r) => r.json()), [])
  const teams = useApi(() => api.api.teams.$get().then((r) => r.json()), [])
  // '' = all teams; the filter is applied on the list we already have.
  const [teamFilter, setTeamFilter] = useState('')
  // null: closed; undefined: "new recruitment"; a job: editing it.
  const [editing, setEditing] = useState<Job | undefined | null>(null)

  const saved = (job: Job) => {
    jobs.setData((list) =>
      list.some((j) => j.id === job.id)
        ? list.map((j) => (j.id === job.id ? job : j))
        : [...list, job],
    )
    setEditing(null)
  }
  const teamName = (id: number | null) => teams.data?.find((team) => team.id === id)?.name

  if (jobs.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!jobs.data) return <p className="text-muted-foreground">{t('common.loading')}</p>

  const shown = teamFilter ? jobs.data.filter((j) => String(j.teamId) === teamFilter) : jobs.data

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Briefcase className="size-5 text-primary" aria-hidden="true" />
          {t('recruitments.title')}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="team-filter" className="sr-only">
            {t('recruitments.filterTeam')}
          </Label>
          <select
            id="team-filter"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">{t('recruitments.allTeams')}</option>
            {teams.data?.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <Button onClick={() => setEditing(undefined)}>
            <Plus data-icon="inline-start" /> {t('recruitments.new')}
          </Button>
        </div>
      </div>
      {shown.length === 0 && <p className="text-muted-foreground">{t('recruitments.empty')}</p>}
      <ul className="grid gap-3">
        {shown.map((job) => (
          <li key={job.id} className="relative">
            <Link
              to={`${APP_ROOT}/recruitments/${job.id}`}
              className="block rounded-lg border bg-card p-4 transition-colors hover:border-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <div className="flex flex-wrap items-start gap-2 pr-10">
                <h3 className="mr-auto font-medium text-primary">{job.title}</h3>
                {teamName(job.teamId) && <Badge variant="outline">{teamName(job.teamId)}</Badge>}
                <Badge variant={job.status === 'open' ? 'default' : 'outline'}>
                  {t(`recruitments.status.${job.status}`)}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>
            </Link>
            {/* Outside the link: a button inside <a> is invalid HTML and breaks keyboard focus. */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3"
              aria-label={t('recruitments.edit')}
              onClick={() => setEditing(job)}
            >
              <Pencil />
            </Button>
          </li>
        ))}
      </ul>
      <RecruitmentForm
        key={editing?.id ?? 'new'}
        job={editing ?? undefined}
        teams={teams.data ?? []}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={saved}
      />
    </>
  )
}
