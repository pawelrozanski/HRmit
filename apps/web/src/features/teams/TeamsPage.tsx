import type { TeamDetail } from '@hrmit/shared'
import { Briefcase, Plus, Users, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Button } from '@/components/ui/button.tsx'
import { APP_ROOT } from '@/config.ts'
import { TeamForm } from './TeamForm.tsx'

export function TeamsPage() {
  const { t } = useTranslation()
  const teams = useApi(() => api.api.teams.$get().then((r) => r.json()), [])
  const [creating, setCreating] = useState(false)

  const created = (team: TeamDetail) => {
    teams.setData((list) => [...list, team].sort((a, b) => a.name.localeCompare(b.name)))
    setCreating(false)
  }

  if (teams.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!teams.data) return <p className="text-muted-foreground">{t('common.loading')}</p>

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <UsersRound className="size-5 text-primary" aria-hidden="true" />
          {t('teams.title')}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" /> {t('teams.new')}
        </Button>
      </div>
      {teams.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card p-10 text-center">
          <UsersRound className="size-8 text-primary" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">{t('teams.empty')}</p>
          <Button onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" /> {t('teams.new')}
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.data.map((team) => (
            <li key={team.id}>
              <Link
                to={`${APP_ROOT}/teams/${team.id}`}
                className="flex h-full flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <h3 className="font-medium text-primary">{team.name}</h3>
                <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                  {team.description}
                </p>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                    {t('teams.memberCount', { count: team.memberCount })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="size-4 text-muted-foreground" aria-hidden="true" />
                    {t('teams.openCount', { count: team.openJobCount })}
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <TeamForm
        key={creating ? 'open' : 'closed'}
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={created}
      />
    </>
  )
}
