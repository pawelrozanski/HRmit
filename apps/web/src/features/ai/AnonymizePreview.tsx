import type { AiPreview } from '@hrmit/shared'
import { Eye } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx'

/**
 * docs/ARCHITECTURE.md §5.2: the user can inspect what a cloud provider would receive.
 * Available for every provider, fetched when opened, never cached or logged.
 */
export function AnonymizePreview({
  candidateId,
  disabled,
}: {
  candidateId: number
  disabled: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<AiPreview | 'loading' | 'error'>('loading')

  const show = async () => {
    setOpen(true)
    setPreview('loading')
    const res = await api.api.ai.preview[':candidateId'].$get({
      param: { candidateId: String(candidateId) },
    })
    setPreview(res.status === 200 ? await res.json() : 'error')
  }

  return (
    <>
      <Button variant="ghost" size="sm" disabled={disabled} onClick={show}>
        <Eye data-icon="inline-start" /> {t('ai.preview')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('ai.previewTitle')}</DialogTitle>
            <DialogDescription>{t('ai.previewHint')}</DialogDescription>
          </DialogHeader>
          {preview === 'loading' && <p className="text-muted-foreground">{t('common.loading')}</p>}
          {preview === 'error' && <p className="text-destructive">{t('common.error')}</p>}
          {typeof preview === 'object' && (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {t(preview.provider === 'local' ? 'ai.local' : 'ai.cloud')}
                </Badge>
                {preview.replacements.length === 0 ? (
                  <span className="text-xs text-muted-foreground">{t('ai.noReplacements')}</span>
                ) : (
                  preview.replacements.map((r) => (
                    <Badge key={r.kind} className="bg-brand-dark text-white">
                      {t(`ai.kinds.${r.kind}`, { count: r.count })}
                    </Badge>
                  ))
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Column title={t('ai.original')} text={preview.original} />
                <Column title={t('ai.anonymized')} text={preview.anonymized} />
              </div>
              <p className="text-xs text-muted-foreground">{t('ai.heuristic')}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Column({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground uppercase">{title}</span>
      <pre className="max-h-96 overflow-auto rounded-lg border bg-cream p-3 font-sans text-xs whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  )
}
