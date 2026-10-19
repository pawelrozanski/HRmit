import { candidateInputSchema, type Candidate } from '@hrmit/shared'
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
  jobId: number
  /** Undefined means "new candidate"; a candidate means "edit this one". */
  candidate?: Candidate
  open: boolean
  onClose: () => void
  onSaved: (candidate: Candidate) => void
}

const FIELDS = ['firstName', 'lastName', 'email', 'phone'] as const

export function CandidateForm({ jobId, candidate, open, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const parsed = candidateInputSchema.safeParse({
      ...Object.fromEntries(new FormData(e.currentTarget)),
      jobId,
      // The stage is changed on the board or in the drawer, not here.
      stage: candidate?.stage,
    })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues, t))
    setErrors({})
    const res = candidate
      ? await api.api.candidates[':id'].$put({
          param: { id: String(candidate.id) },
          json: parsed.data,
        })
      : await api.api.candidates.$post({ json: parsed.data })
    if (res.status !== 200 && res.status !== 201) return setFailed(true)
    setFailed(false)
    onSaved(await res.json())
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{candidate ? t('candidates.edit') : t('candidates.new')}</DialogTitle>
            <DialogDescription>{t('candidates.formHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {FIELDS.map((name) => (
              <div key={name} className="grid gap-1.5">
                <Label htmlFor={name}>{t(`candidates.${name}`)}</Label>
                <Input
                  id={name}
                  name={name}
                  type={name === 'email' ? 'email' : 'text'}
                  defaultValue={candidate?.[name]}
                  aria-invalid={!!errors[name]}
                />
                {errors[name] && <p className="text-xs text-destructive">{errors[name]}</p>}
              </div>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">{t('candidates.notes')}</Label>
            <Textarea id="notes" name="notes" rows={4} defaultValue={candidate?.notes} />
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
