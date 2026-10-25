import { Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { backupUrl } from '@/api/client.ts'
import { Button } from '@/components/ui/button.tsx'
import { IS_DEMO } from '@/config.ts'

/**
 * One button: fetch GET /api/backup and hand the file to the browser. Fetched rather than a
 * plain download link so the demo's service worker can answer it too and a failure shows here.
 */
export function BackupSettings() {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'failed'>('idle')
  const [last, setLast] = useState<{ name: string; bytes: number; at: Date } | null>(null)

  const download = async () => {
    setStatus('working')
    try {
      const res = await fetch(backupUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const name =
        /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ??
        'hrmit-backup'
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: name })
      a.click()
      URL.revokeObjectURL(url)
      setLast({ name, bytes: blob.size, at: new Date() })
      setStatus('done')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className="grid max-w-xl gap-5">
      <div>
        <h2 className="text-xl font-semibold">{t('backup.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {IS_DEMO ? t('backup.demoIntro') : t('backup.intro')}
        </p>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>{t('backup.contains')}</li>
        <li>{t('backup.noKey')}</li>
        <li>{t('backup.restore')}</li>
      </ul>
      <div className="flex items-center gap-3">
        <Button type="button" disabled={status === 'working'} onClick={download}>
          <Download data-icon="inline-start" />
          {status === 'working' ? t('backup.working') : t('backup.download')}
        </Button>
        {status === 'done' && last && (
          <span className="text-sm text-muted-foreground">
            {t('backup.done', {
              name: last.name,
              size: new Intl.NumberFormat(i18n.language, {
                style: 'unit',
                unit: last.bytes > 1_000_000 ? 'megabyte' : 'kilobyte',
                maximumFractionDigits: 1,
              }).format(last.bytes / (last.bytes > 1_000_000 ? 1_000_000 : 1_000)),
            })}
          </span>
        )}
        {status === 'failed' && (
          <span role="alert" className="text-sm text-destructive">
            {t('common.error')}
          </span>
        )}
      </div>
    </div>
  )
}
