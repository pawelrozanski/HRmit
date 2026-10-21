import type { TeamDetail } from '@hrmit/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Button } from '@/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { fullName } from '../employees/EmployeeDrawer.tsx'

type Props = {
  team: TeamDetail
  open: boolean
  onClose: () => void
  onSaved: (team: TeamDetail) => void
}

/**
 * Native checkboxes in a form: Tab reaches the search, then each box; Space toggles, Enter
 * submits. The search only hides rows, ticked ones stay ticked.
 */
export function AddMembersDialog({ team, open, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [failed, setFailed] = useState(false)
  const employees = useApi(
    () => api.api.employees.$get({ query: {} }).then((r) => r.json()),
    [open],
  )
  const inTeam = new Set(team.members.map((m) => m.id))
  const candidates = (employees.data ?? []).filter((e) => !inTeam.has(e.id))
  const needle = q.trim().toLowerCase()
  const shown = candidates.filter(
    (e) => !needle || `${fullName(e)} ${e.position}`.toLowerCase().includes(needle),
  )

  const toggle = (id: number, on: boolean) =>
    setPicked((list) => (on ? [...list, id] : list.filter((x) => x !== id)))

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (picked.length === 0) return
    const res = await api.api.teams[':id'].members.$post({
      param: { id: String(team.id) },
      json: { employeeIds: picked },
    })
    if (res.status !== 200) return setFailed(true)
    setFailed(false)
    onSaved(await res.json())
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('teams.addMembers')}</DialogTitle>
            <DialogDescription>{t('teams.addMembersHint')}</DialogDescription>
          </DialogHeader>
          {employees.error ? (
            <p className="text-destructive">{t('common.error')}</p>
          ) : !employees.data ? (
            <p className="text-muted-foreground">{t('common.loading')}</p>
          ) : candidates.length === 0 ? (
            <p className="text-muted-foreground">{t('teams.everyoneIn')}</p>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="member-search">{t('teams.searchEmployees')}</Label>
                {/* The list loads after the dialog opens, so the dialog's own initial focus
                    lands on Cancel; move it to the search once there is something to search. */}
                <Input
                  id="member-search"
                  type="search"
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <fieldset className="max-h-72 overflow-y-auto rounded-lg border">
                <legend className="sr-only">{t('employees.title')}</legend>
                {shown.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">{t('employees.noMatch')}</p>
                )}
                {shown.map((e) => (
                  <label
                    key={e.id}
                    className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-brand"
                      checked={picked.includes(e.id)}
                      onChange={(ev) => toggle(e.id, ev.target.checked)}
                      // Browsers do not submit a form on Enter from a checkbox; the hint promises it.
                      onKeyDown={(ev) =>
                        ev.key === 'Enter' && ev.currentTarget.form?.requestSubmit()
                      }
                    />
                    <span className="font-medium">{fullName(e)}</span>
                    <span className="text-muted-foreground">{e.position}</span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t('form.saveFailed')}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={picked.length === 0}>
              {t('teams.add', { count: picked.length })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
