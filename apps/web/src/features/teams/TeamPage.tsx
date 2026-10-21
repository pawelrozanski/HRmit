import type { TeamDetail, TeamMemberRole } from '@hrmit/shared'
import { Briefcase, Pencil, Plus, Trash2, UserMinus, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { APP_ROOT } from '@/config.ts'
import { fullName } from '../employees/EmployeeDrawer.tsx'
import { AddMembersDialog } from './AddMembersDialog.tsx'
import { TeamForm } from './TeamForm.tsx'

export function TeamPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const team = useApi(
    () =>
      api.api.teams[':id'].$get({ param: { id } }).then((r) => {
        if (r.status === 404) return null
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
    [id],
  )
  const param = { id }
  const set = (next: TeamDetail) => team.setData(() => next)

  const remove = async (current: TeamDetail) => {
    const ok = window.confirm(
      t('teams.deleteConfirm', {
        name: current.name,
        jobs: current.jobs.length,
        members: current.members.length,
      }),
    )
    if (!ok) return
    const res = await api.api.teams[':id'].$delete({ param })
    if (res.status !== 204) return setError(t('teams.deleteFailed'))
    navigate(`${APP_ROOT}/teams`)
  }

  const setRole = async (employeeId: number, role: TeamMemberRole) => {
    const res = await api.api.teams[':id'].members[':employeeId'].$patch({
      param: { ...param, employeeId: String(employeeId) },
      json: { role },
    })
    if (res.status !== 200) return setError(t('form.saveFailed'))
    setError(null)
    set(await res.json())
  }

  const removeMember = async (current: TeamDetail, employeeId: number) => {
    const res = await api.api.teams[':id'].members[':employeeId'].$delete({
      param: { ...param, employeeId: String(employeeId) },
    })
    if (res.status !== 204) return setError(t('form.saveFailed'))
    setError(null)
    set({
      ...current,
      members: current.members.filter((m) => m.id !== employeeId),
      memberCount: current.memberCount - 1,
    })
  }

  if (team.error) return <p className="text-destructive">{t('common.error')}</p>
  if (team.data === undefined) return <p className="text-muted-foreground">{t('common.loading')}</p>

  const back = (
    <Link to={`${APP_ROOT}/teams`} className="text-sm text-primary hover:underline">
      ← {t('common.back')}
    </Link>
  )
  if (team.data === null)
    return (
      <>
        {back}
        <p className="mt-4 text-muted-foreground">{t('teams.notFound')}</p>
      </>
    )
  const current = team.data

  return (
    <>
      {back}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{current.name}</h2>
          {current.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{current.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil data-icon="inline-start" /> {t('common.edit')}
          </Button>
          <Button variant="destructive" onClick={() => remove(current)}>
            <Trash2 data-icon="inline-start" /> {t('common.delete')}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="mt-6" aria-labelledby="team-members">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 id="team-members" className="flex items-center gap-2 font-semibold">
            <Users className="size-4 text-primary" aria-hidden="true" />
            {t('teams.members')} ({current.members.length})
          </h3>
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" /> {t('teams.addMembers')}
          </Button>
        </div>
        {current.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('teams.noMembers')}</p>
        ) : (
          <ul className="grid gap-2">
            {current.members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card p-3 text-sm"
              >
                <span className="font-medium">{fullName(m)}</span>
                <span className="text-muted-foreground">{m.position}</span>
                <Badge variant={m.role === 'lead' ? 'default' : 'outline'}>
                  {t(`teams.roles.${m.role}`)}
                </Badge>
                <span className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${m.role === 'lead' ? t('teams.makeMember') : t('teams.makeLead')}: ${fullName(m)}`}
                    onClick={() => setRole(m.id, m.role === 'lead' ? 'member' : 'lead')}
                  >
                    {m.role === 'lead' ? t('teams.makeMember') : t('teams.makeLead')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${t('teams.remove')}: ${fullName(m)}`}
                    onClick={() => removeMember(current, m.id)}
                  >
                    <UserMinus data-icon="inline-start" /> {t('teams.remove')}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6" aria-labelledby="team-jobs">
        <h3 id="team-jobs" className="mb-3 flex items-center gap-2 font-semibold">
          <Briefcase className="size-4 text-primary" aria-hidden="true" />
          {t('teams.recruitments')} ({current.jobs.length})
        </h3>
        {current.jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('teams.noRecruitments')}</p>
        ) : (
          <ul className="grid gap-2">
            {current.jobs.map((job) => (
              <li key={job.id}>
                <Link
                  to={`${APP_ROOT}/recruitments/${job.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:border-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="font-medium text-primary">{job.title}</span>
                  <Badge variant={job.status === 'open' ? 'default' : 'outline'}>
                    {t(`recruitments.status.${job.status}`)}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TeamForm
        key={editing ? 'open' : 'closed'}
        team={current}
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={(next) => {
          setEditing(false)
          set(next)
        }}
      />
      <AddMembersDialog
        key={adding ? 'open' : 'closed'}
        team={current}
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(next) => {
          setAdding(false)
          set(next)
        }}
      />
    </>
  )
}
