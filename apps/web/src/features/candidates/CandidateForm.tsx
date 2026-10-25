import { candidateInputSchema, type Candidate, type CvImport } from '@hrmit/shared'
import { FileUp } from 'lucide-react'
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
  // Import from CV: the parsed fields prefill the inputs, the file is uploaded after saving.
  const [imported, setImported] = useState<CvImport | null>(null)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const importCv = async (file: File | undefined) => {
    if (!file) return
    setImporting(true)
    setImportError(null)
    const res = await api.api.ai['parse-cv'].$post({ form: { file } })
    setImporting(false)
    if (res.status !== 200)
      return setImportError(
        res.status === 413 ? 'cv.tooLarge' : res.status === 415 ? 'cv.badType' : 'cv.noText',
      )
    setImported(await res.json())
    setCvFile(file)
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const parsed = candidateInputSchema.safeParse({
      ...Object.fromEntries(new FormData(e.currentTarget)),
      jobId,
      // The stage is changed on the board or on the candidate's page, not here.
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
    let saved = await res.json()
    if (cvFile) {
      const up = await api.api.candidates[':id'].cv.$post({
        param: { id: String(saved.id) },
        form: { file: cvFile },
      })
      if (up.status === 200) saved = await up.json()
    }
    onSaved(saved)
  }

  // Inputs are uncontrolled; a new key remounts them with the imported defaults.
  const fieldsKey = imported ? imported.fields.email + imported.fields.lastName : 'blank'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{candidate ? t('candidates.edit') : t('candidates.new')}</DialogTitle>
            <DialogDescription>{t('candidates.formHint')}</DialogDescription>
          </DialogHeader>
          {!candidate && (
            <div className="grid gap-1.5">
              <label
                className={`inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm hover:border-brand ${importing ? 'pointer-events-none opacity-50' : ''}`}
              >
                <FileUp className="size-4" />
                {importing ? t('candidates.importing') : t('candidates.importCv')}
                <input
                  type="file"
                  accept=".pdf,.docx"
                  className="sr-only"
                  onChange={(e) => void importCv(e.target.files?.[0])}
                />
              </label>
              {importError && (
                <p role="alert" className="text-xs text-destructive">
                  {t(importError)}
                </p>
              )}
              {imported && (
                <p className="text-xs text-muted-foreground">
                  {t(
                    imported.source === 'ai'
                      ? 'candidates.importedAi'
                      : 'candidates.importedHeuristic',
                  )}{' '}
                  {cvFile && t('candidates.cvAttached', { name: cvFile.name })}
                </p>
              )}
            </div>
          )}
          <div key={fieldsKey} className="grid grid-cols-2 gap-4">
            {FIELDS.map((name) => (
              <div key={name} className="grid gap-1.5">
                <Label htmlFor={name}>{t(`candidates.${name}`)}</Label>
                <Input
                  id={name}
                  name={name}
                  type={name === 'email' ? 'email' : 'text'}
                  defaultValue={imported?.fields[name] || candidate?.[name]}
                  aria-invalid={!!errors[name]}
                />
                {errors[name] && <p className="text-xs text-destructive">{errors[name]}</p>}
              </div>
            ))}
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
