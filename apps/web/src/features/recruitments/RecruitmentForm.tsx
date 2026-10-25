import { JOB_LEVELS, SALARY_PERIODS, jobInputSchema, type Job, type Team } from '@hrmit/shared'
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
  /** Undefined means "new recruitment"; a job means "edit this one". */
  job?: Job
  teams: Team[]
  open: boolean
  onClose: () => void
  onSaved: (job: Job) => void
}

export const selectClass = 'h-8 rounded-lg border bg-background px-2 text-sm'

/** Plain <form> + FormData, validated with the shared zod schema; no form library needed. */
export function RecruitmentForm({ job, teams, open, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { teamId, level, salaryMin, salaryMax, salaryCurrency, ...fields } = Object.fromEntries(
      new FormData(e.currentTarget),
    )
    // Empty number inputs mean "not disclosed"; anything else goes to zod as a number.
    const num = (v: FormDataEntryValue | undefined) => (v ? Number(v) : null)
    const parsed = jobInputSchema.safeParse({
      ...fields,
      teamId: num(teamId),
      level: level || null,
      salaryMin: num(salaryMin),
      salaryMax: num(salaryMax),
      salaryCurrency: String(salaryCurrency ?? '')
        .trim()
        .toUpperCase(),
    })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues, t))
    setErrors({})
    const res = job
      ? await api.api.jobs[':id'].$put({ param: { id: String(job.id) }, json: parsed.data })
      : await api.api.jobs.$post({ json: parsed.data })
    if (res.status !== 200 && res.status !== 201) return setFailed(true)
    setFailed(false)
    onSaved(await res.json())
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{job ? t('recruitments.edit') : t('recruitments.new')}</DialogTitle>
            <DialogDescription>{t('recruitments.formHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="title">{t('recruitments.titleLabel')}</Label>
            <Input
              id="title"
              name="title"
              defaultValue={job?.title}
              aria-invalid={!!errors.title}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="description">{t('recruitments.descriptionLabel')}</Label>
            <Textarea
              id="description"
              name="description"
              rows={5}
              defaultValue={job?.description}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="level">{t('recruitments.levelLabel')}</Label>
              <select
                id="level"
                name="level"
                defaultValue={job?.level ?? ''}
                className={selectClass}
              >
                <option value="">{t('recruitments.noLevel')}</option>
                {JOB_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {t(`recruitments.level.${l}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="location">{t('recruitments.locationLabel')}</Label>
              <Input
                id="location"
                name="location"
                defaultValue={job?.location}
                placeholder={t('recruitments.locationPlaceholder')}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contract">{t('recruitments.contractLabel')}</Label>
            <Input
              id="contract"
              name="contract"
              defaultValue={job?.contract}
              placeholder={t('recruitments.contractPlaceholder')}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="requirements">{t('recruitments.requirementsLabel')}</Label>
            <Textarea
              id="requirements"
              name="requirements"
              rows={4}
              defaultValue={job?.requirements}
              aria-describedby="lines-hint"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="niceToHave">{t('recruitments.niceToHaveLabel')}</Label>
            <Textarea
              id="niceToHave"
              name="niceToHave"
              rows={3}
              defaultValue={job?.niceToHave}
              aria-describedby="lines-hint"
            />
            <p id="lines-hint" className="text-xs text-muted-foreground">
              {t('recruitments.linesHint')}
            </p>
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">{t('recruitments.salaryLabel')}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Input
                name="salaryMin"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                aria-label={t('recruitments.salaryMin')}
                placeholder={t('recruitments.salaryMin')}
                defaultValue={job?.salaryMin ?? ''}
              />
              <Input
                name="salaryMax"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                aria-label={t('recruitments.salaryMax')}
                placeholder={t('recruitments.salaryMax')}
                defaultValue={job?.salaryMax ?? ''}
                aria-invalid={!!errors.salaryMax}
              />
              <Input
                name="salaryCurrency"
                maxLength={3}
                aria-label={t('recruitments.salaryCurrency')}
                defaultValue={job?.salaryCurrency ?? 'PLN'}
                aria-invalid={!!errors.salaryCurrency}
              />
              <select
                name="salaryPeriod"
                aria-label={t('recruitments.salaryPeriodLabel')}
                defaultValue={job?.salaryPeriod ?? 'month'}
                className={selectClass}
              >
                {SALARY_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {t(`recruitments.period.${p}`)}
                  </option>
                ))}
              </select>
            </div>
            {(errors.salaryMax || errors.salaryCurrency) && (
              <p className="text-xs text-destructive">
                {errors.salaryMax ?? errors.salaryCurrency}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{t('recruitments.salaryHint')}</p>
          </fieldset>
          <div className="grid gap-1.5">
            <Label htmlFor="teamId">{t('recruitments.teamLabel')}</Label>
            <select
              id="teamId"
              name="teamId"
              defaultValue={job?.teamId ?? ''}
              className={selectClass}
            >
              <option value="">{t('recruitments.noTeam')}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          {job && (
            <div className="grid gap-1.5">
              <Label htmlFor="status">{t('recruitments.statusLabel')}</Label>
              <select id="status" name="status" defaultValue={job.status} className={selectClass}>
                <option value="open">{t('recruitments.status.open')}</option>
                <option value="closed">{t('recruitments.status.closed')}</option>
              </select>
            </div>
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
            <Button type="submit">{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
