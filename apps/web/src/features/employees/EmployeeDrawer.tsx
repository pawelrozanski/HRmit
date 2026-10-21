import type { EmployeeWithTeams } from '@hrmit/shared'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '@/api/client.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx'
import { APP_ROOT } from '@/config.ts'
import { EmployeeForm } from './EmployeeForm.tsx'

type Props = {
  employee: EmployeeWithTeams | null
  onClose: () => void
  onChange: (e: EmployeeWithTeams) => void
  onDelete: (e: EmployeeWithTeams) => void
}

export const fullName = (e: { firstName: string; lastName: string }) =>
  `${e.firstName} ${e.lastName}`

export function EmployeeDrawer({ employee, onClose, onChange, onDelete }: Props) {
  const { t, i18n } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language)

  // Native confirm(): one line, keyboard accessible, no extra component. Hard delete (GDPR).
  const remove = async (e: EmployeeWithTeams) => {
    if (!window.confirm(t('employees.deleteConfirm', { name: fullName(e) }))) return
    const res = await api.api.employees[':id'].$delete({ param: { id: String(e.id) } })
    if (res.status !== 204) return setDeleteFailed(true)
    setDeleteFailed(false)
    onDelete(e)
  }

  return (
    <Sheet open={employee !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto">
        {employee && (
          <>
            <SheetHeader>
              <SheetTitle className="text-lg">{fullName(employee)}</SheetTitle>
              <SheetDescription>{employee.position}</SheetDescription>
            </SheetHeader>
            <dl className="grid gap-3 px-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('employees.email')}</dt>
                <dd>
                  <a href={`mailto:${employee.email}`} className="text-primary hover:underline">
                    {employee.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('employees.hiredAt')}</dt>
                <dd>{employee.hiredAt ? date(employee.hiredAt) : '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('employees.duties')}</dt>
                <dd className="whitespace-pre-line">
                  {employee.duties || (
                    <span className="text-muted-foreground italic">{t('employees.noDuties')}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('employees.teams')}</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {employee.teams.length === 0 && (
                    <span className="text-muted-foreground italic">{t('employees.noTeams')}</span>
                  )}
                  {employee.teams.map((team) => (
                    <Badge
                      key={team.id}
                      variant={team.role === 'lead' ? 'default' : 'outline'}
                      asChild
                    >
                      <Link to={`${APP_ROOT}/teams/${team.id}`}>
                        {team.name}
                        {team.role === 'lead' && ` · ${t('teams.roles.lead')}`}
                      </Link>
                    </Badge>
                  ))}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 px-4">
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil data-icon="inline-start" /> {t('common.edit')}
              </Button>
              <Button variant="destructive" onClick={() => remove(employee)}>
                <Trash2 data-icon="inline-start" /> {t('common.delete')}
              </Button>
            </div>
            {deleteFailed && (
              <p role="alert" className="px-4 text-sm text-destructive">
                {t('employees.deleteFailed')}
              </p>
            )}
            <EmployeeForm
              key={editing ? 'open' : 'closed'}
              employee={employee}
              open={editing}
              onClose={() => setEditing(false)}
              onSaved={(e) => {
                setEditing(false)
                onChange(e)
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
