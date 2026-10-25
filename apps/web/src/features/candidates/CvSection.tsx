import type { Candidate } from '@hrmit/shared'
import { Download, Upload } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api, cvUrl } from '@/api/client.ts'
import { IS_DEMO } from '@/config.ts'
import { cn } from '@/lib/utils.ts'
import { useBlind } from './BlindContext.ts'

type Props = { candidate: Candidate; onUploaded: (c: Candidate) => void }

/** Drop zone over a native file input, download link and the extracted text. */
export function CvSection({ candidate, onUploaded }: Props) {
  const { t } = useTranslation()
  const blind = useBlind()
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    const res = await api.api.candidates[':id'].cv.$post({
      param: { id: String(candidate.id) },
      form: { file },
    })
    setBusy(false)
    if (res.status === 200) return onUploaded(await res.json())
    setError(res.status === 413 ? 'tooLarge' : res.status === 415 ? 'badType' : 'failed')
  }

  const drop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void upload(e.dataTransfer.files[0])
  }

  const inputId = `cv-${candidate.id}`
  return (
    <div className="grid gap-2">
      <label
        htmlFor={inputId}
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn(
          'flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-brand',
          dragging && 'border-brand bg-brand/5',
          busy && 'pointer-events-none opacity-50',
        )}
      >
        <Upload className="size-4" />
        {busy ? t('cv.uploading') : t('cv.drop')}
        <input
          id={inputId}
          type="file"
          accept=".pdf,.docx"
          className="sr-only"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {t(`cv.${error}`)}
        </p>
      )}
      {candidate.cvFilename === null ? (
        <p className="text-sm text-muted-foreground">{t('cv.none')}</p>
      ) : blind ? (
        <p className="text-sm text-muted-foreground italic">{t('cv.hidden')}</p>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm">
            <span className="truncate">{candidate.cvFilename}</span>
            {/* The demo stores no files, so there is nothing to download there. */}
            {!IS_DEMO && (
              <a
                href={cvUrl(candidate.id)}
                download
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Download className="size-4" /> {t('cv.download')}
              </a>
            )}
          </p>
          {candidate.cvText ? (
            // Scrollable, so it takes keyboard focus (axe scrollable-region-focusable).
            <pre
              tabIndex={0}
              aria-label={t('cv.title')}
              className="max-h-64 overflow-auto rounded-md border bg-muted p-3 font-sans text-xs whitespace-pre-wrap"
            >
              {candidate.cvText}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">{t('cv.noText')}</p>
          )}
        </>
      )}
    </div>
  )
}
