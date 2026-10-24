import type { EmployeeWithTeams } from '@hrmit/shared'
import { NotebookPen, Plus, Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { selectClass } from '../recruitments/RecruitmentForm.tsx'
import { EmployeeDrawer, fullName } from './EmployeeDrawer.tsx'
import { EmployeeForm } from './EmployeeForm.tsx'

export function EmployeesPage() {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [teamId, setTeamId] = useState('')
  const [selected, setSelected] = useState<EmployeeWithTeams | null>(null)
  const [creating, setCreating] = useState(false)
  const teams = useApi(() => api.api.teams.$get().then((r) => r.json()), [])
  // The server filters; refetched on every change (the list is small, no debounce needed).
  const employees = useApi(
    () =>
      api.api.employees
        .$get({
          query: { ...(q.trim() && { q: q.trim() }), ...(teamId && { teamId: Number(teamId) }) },
        })
        .then((r) => {
          if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
          return r.json()
        }),
    [q, teamId],
  )
  // ?open=ID (dashboard links) opens that drawer once; the param is then dropped.
  const [params, setParams] = useSearchParams()
  const openId = params.get('open')
  useEffect(() => {
    if (!openId || !employees.data) return
    setSelected(employees.data.find((e) => String(e.id) === openId) ?? null)
    setParams({}, { replace: true })
  }, [openId, employees.data])
  const filtering = q.trim() !== '' || teamId !== ''

  const replace = (e: EmployeeWithTeams) => {
    employees.setData((list) => list.map((x) => (x.id === e.id ? e : x)))
    setSelected((s) => (s?.id === e.id ? e : s))
  }
  const created = (e: EmployeeWithTeams) => {
    employees.setData((list) => [...list, e].sort((a, b) => fullName(a).localeCompare(fullName(b))))
    setCreating(false)
  }
  const deleted = (e: EmployeeWithTeams) => {
    employees.setData((list) => list.filter((x) => x.id !== e.id))
    setSelected(null)
  }

  if (employees.error) return <p className="text-destructive">{t('common.error')}</p>

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Users className="size-5 text-primary" aria-hidden="true" />
          {t('employees.title')}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" /> {t('employees.new')}
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('employees.intro')}</p>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid min-w-60 flex-1 gap-1.5">
          <Label htmlFor="employee-search">{t('employees.search')}</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="employee-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="employee-team">{t('employees.filterTeam')}</Label>
          <select
            id="employee-team"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className={selectClass}
          >
            <option value="">{t('employees.allTeams')}</option>
            {teams.data?.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!employees.data ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : employees.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card p-10 text-center">
          <Users className="size-8 text-primary" aria-hidden="true" />
          <p className="font-medium">{filtering ? t('employees.noMatch') : t('employees.empty')}</p>
          {!filtering && (
            <Button onClick={() => setCreating(true)}>
              <Plus data-icon="inline-start" /> {t('employees.new')}
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid gap-2">
          {employees.data.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setSelected(e)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card p-3 text-left transition-colors hover:border-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="font-medium text-primary">{fullName(e)}</span>
                <span className="text-sm text-muted-foreground">{e.position}</span>
                {e.noteCount > 0 && (
                  <span
                    className="flex items-center gap-1 text-xs text-muted-foreground"
                    aria-label={t('employees.notes.count', { count: e.noteCount })}
                  >
                    <NotebookPen className="size-3.5" aria-hidden="true" />
                    {e.noteCount}
                  </span>
                )}
                <span className="ml-auto flex flex-wrap gap-1.5">
                  {e.teams.map((team) => (
                    <Badge key={team.id} variant={team.role === 'lead' ? 'default' : 'outline'}>
                      {team.name}
                    </Badge>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <EmployeeDrawer
        employee={selected}
        onClose={() => setSelected(null)}
        onChange={replace}
        onDelete={deleted}
      />
      <EmployeeForm
        key={creating ? 'open' : 'closed'}
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={created}
      />
    </>
  )
}
