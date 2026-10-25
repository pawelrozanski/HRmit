import { Download, Upload } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api, backupUrl } from '@/api/client.ts'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { IS_DEMO } from '@/config.ts'

/** Backup: one download button. Recovery: the same file back, then a full reload. */
export function BackupSettings() {
  return (
    <div className="grid max-w-xl gap-10">
      <Backup />
      <Recovery />
    </div>
  )
}

/**
 * Fetched rather than a plain download link so the demo's service worker can answer it too
 * and a failure shows here.
 */
function Backup() {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'failed'>('idle')
  const [last, setLast] = useState<{ name: string; bytes: number } | null>(null)

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
      setLast({ name, bytes: blob.size })
      setStatus('done')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <section className="grid gap-5">
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
    </section>
  )
}

/** A native file input and one confirm; on success the whole app reloads, every cache is stale. */
function Recovery() {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ candidates: number; files: number } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file || !window.confirm(t('backup.restoreConfirm'))) return
    setStatus('working')
    setError(null)
    const res = await api.api.backup.restore.$post({ form: { file } })
    if (res.status !== 200) {
      setStatus('idle')
      return setError(
        res.status === 415
          ? t('backup.notArchive')
          : res.status === 422
            ? t('backup.damaged')
            : t('common.error'),
      )
    }
    setResult(await res.json())
    setStatus('done')
    setTimeout(() => window.location.reload(), 1500)
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div>
        <h2 className="text-xl font-semibold">{t('backup.recoveryTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {IS_DEMO ? t('backup.demoRecoveryIntro') : t('backup.recoveryIntro')}
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="backup-file">{t('backup.file')}</Label>
        <Input
          id="backup-file"
          type="file"
          accept={IS_DEMO ? '.json,application/json' : '.gz,.tgz,application/gzip'}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setError(null)
          }}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="destructive" disabled={!file || status !== 'idle'}>
          <Upload data-icon="inline-start" />
          {status === 'working' ? t('backup.restoring') : t('backup.restoreButton')}
        </Button>
        {status === 'done' && result && (
          <span role="status" className="text-sm text-muted-foreground">
            {t('backup.restored', result)}
          </span>
        )}
        {error && (
          <span role="alert" className="text-sm text-destructive">
            {error}
          </span>
        )}
      </div>
    </form>
  )
}
