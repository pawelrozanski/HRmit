import type { ReactNode } from 'react'
import { PIPELINE_STAGES, type Candidate, type PipelineStage } from '@hrmit/shared'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { Button } from '@/components/ui/button.tsx'
import { AiSection } from '../ai/AiSection.tsx'
import { EmailSection } from '../email/EmailSection.tsx'
import { MeetingsSection } from '../meetings/MeetingsSection.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx'
import { useBlind } from './BlindContext.ts'
import { CandidateForm } from './CandidateForm.tsx'
import { candidateName } from './candidateName.ts'
import { CvSection } from './CvSection.tsx'
import { Scorecard } from './Scorecard.tsx'

type Props = {
  candidate: Candidate | null
  onClose: () => void
  onMove: (c: Candidate, stage: PipelineStage) => void
  onChange: (c: Candidate) => void
  onDelete: (c: Candidate) => void
  onOpenGuide: () => void
}

export function CandidateDrawer({
  candidate,
  onClose,
  onMove,
  onChange,
  onDelete,
  onOpenGuide,
}: Props) {
  const { t, i18n } = useTranslation()
  const blind = useBlind()
  const [editing, setEditing] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  // Bumped after an invite goes out: remounts the email history so the new row shows up.
  const [emailsKey, setEmailsKey] = useState(0)
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language)
  const hidden = <span className="text-muted-foreground italic">{t('candidates.hidden')}</span>

  // Native confirm(): one line, keyboard accessible, no extra component.
  const remove = async (c: Candidate) => {
    if (!window.confirm(t('candidates.deleteConfirm', { name: candidateName(c, blind, t) }))) return
    const res = await api.api.candidates[':id'].$delete({ param: { id: String(c.id) } })
    if (res.status !== 204) return setDeleteFailed(true)
    setDeleteFailed(false)
    onDelete(c)
  }

  return (
    <Sheet open={candidate !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto">
        {candidate && (
          <>
            <SheetHeader>
              <SheetTitle>{candidateName(candidate, blind, t)}</SheetTitle>
              <SheetDescription>{t('candidates.details')}</SheetDescription>
            </SheetHeader>
            <dl className="grid gap-3 px-4 text-sm">
              <Field label={t('candidates.stage')}>
                {/* Keyboard-friendly alternative to dragging on the board. */}
                <select
                  aria-label={t('candidates.moveTo')}
                  value={candidate.stage}
                  onChange={(e) => onMove(candidate, e.target.value as PipelineStage)}
                  className="rounded-md border bg-background px-2 py-1"
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {t(`stage.${s}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('candidates.email')}>
                {blind ? hidden : <a href={`mailto:${candidate.email}`}>{candidate.email}</a>}
              </Field>
              <Field label={t('candidates.phone')}>{blind ? hidden : candidate.phone}</Field>
              <Field label={t('candidates.stageChanged')}>{date(candidate.stageChangedAt)}</Field>
              <Field label={t('candidates.applied')}>{date(candidate.createdAt)}</Field>
              <Field label={t('candidates.notes')}>
                {candidate.notes || (
                  <span className="text-muted-foreground">{t('candidates.noNotes')}</span>
                )}
              </Field>
              <Field label={t('cv.title')}>
                <CvSection candidate={candidate} onUploaded={onChange} />
              </Field>
              <Field label={t('ai.title')}>
                <AiSection candidate={candidate} onChange={onChange} />
              </Field>
              <Field label={t('scorecard.title')}>
                <Scorecard candidate={candidate} onOpenGuide={onOpenGuide} />
              </Field>
              <Field label={t('meetings.title')}>
                <MeetingsSection
                  candidate={candidate}
                  onScheduled={() => setEmailsKey((k) => k + 1)}
                />
              </Field>
              <Field label={t('email.title')}>
                <EmailSection key={emailsKey} candidate={candidate} />
              </Field>
            </dl>
            <div className="mt-auto flex items-center justify-between gap-2 border-t p-4">
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil data-icon="inline-start" /> {t('common.edit')}
              </Button>
              <Button variant="destructive" onClick={() => remove(candidate)}>
                <Trash2 data-icon="inline-start" /> {t('common.delete')}
              </Button>
            </div>
            {deleteFailed && (
              <p role="alert" className="px-4 pb-4 text-sm text-destructive">
                {t('candidates.deleteFailed')}
              </p>
            )}
            <CandidateForm
              key={candidate.id}
              jobId={candidate.jobId}
              candidate={candidate}
              open={editing}
              onClose={() => setEditing(false)}
              onSaved={(c) => {
                setEditing(false)
                onChange(c)
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}
