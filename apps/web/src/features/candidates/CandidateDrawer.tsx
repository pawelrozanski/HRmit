import type { ReactNode } from 'react'
import { PIPELINE_STAGES, type Candidate, type PipelineStage } from '@hrmit/shared'
import { useTranslation } from 'react-i18next'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx'
import { useBlind } from './BlindContext.ts'
import { candidateName } from './candidateName.ts'

type Props = {
  candidate: Candidate | null
  onClose: () => void
  onMove: (c: Candidate, stage: PipelineStage) => void
}

export function CandidateDrawer({ candidate, onClose, onMove }: Props) {
  const { t, i18n } = useTranslation()
  const blind = useBlind()
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language)
  const hidden = <span className="text-muted-foreground italic">{t('candidates.hidden')}</span>

  return (
    <Sheet open={candidate !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
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
            </dl>
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
