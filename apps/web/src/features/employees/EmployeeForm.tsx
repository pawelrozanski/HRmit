import { employeeInputSchema, type EmployeeWithTeams } from '@hrmit/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
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
import { Textarea } from '@/components/ui/textarea.tsx'
import { fieldErrors } from '@/lib/form.ts'

type Props = {
  /** Undefined means "new employee"; an employee means "edit this one". */
  employee?: EmployeeWithTeams
  open: boolean
  onClose: () => void
  onSaved: (employee: EmployeeWithTeams) => void
}

const TEXT_FIELDS = ['firstName', 'lastName', 'position', 'email'] as const

/** Plain <form> + FormData, validated with the shared zod schema, like the other forms. */
export function EmployeeForm({ employee, open, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { hiredAt, ...fields } = Object.fromEntries(new FormData(e.currentTarget))
    // An empty <input type="date"> submits '', the API wants null.
    const parsed = employeeInputSchema.safeParse({ ...fields, hiredAt: hiredAt || null })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues, t))
    setErrors({})
    const res = employee
      ? await api.api.employees[':id'].$put({
          param: { id: String(employee.id) },
          json: parsed.data,
        })
      : await api.api.employees.$post({ json: parsed.data })
    if (res.status !== 200 && res.status !== 201) return setFailed(true)
    setFailed(false)
    onSaved(await res.json())
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{employee ? t('employees.edit') : t('employees.new')}</DialogTitle>
            <DialogDescription>{t('employees.formHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {TEXT_FIELDS.map((name) => (
              <div key={name} className="grid gap-1.5">
                <Label htmlFor={name}>{t(`employees.${name}`)}</Label>
                <Input
                  id={name}
                  name={name}
                  type={name === 'email' ? 'email' : 'text'}
                  defaultValue={employee?.[name]}
                  aria-invalid={!!errors[name]}
                />
                {errors[name] && <p className="text-xs text-destructive">{errors[name]}</p>}
              </div>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hiredAt">{t('employees.hiredAt')}</Label>
            <Input
              id="hiredAt"
              name="hiredAt"
              type="date"
              defaultValue={employee?.hiredAt ?? ''}
              aria-invalid={!!errors.hiredAt}
              className="w-fit"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="duties">{t('employees.duties')}</Label>
            <Textarea id="duties" name="duties" rows={4} defaultValue={employee?.duties} />
            <p className="text-xs text-muted-foreground">{t('employees.dutiesHint')}</p>
          </div>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t('form.saveFailed')}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
