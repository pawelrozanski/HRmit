import type { UpdateCheck, UpdateRun } from '@hrmit/shared'
import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
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

const REPO = 'https://github.com/pawelrozanski/HRmit'
const REFUSALS = ['not a git checkout', 'up to date', 'local changes'] as const

type Phase =
  | { kind: 'checking' }
  | { kind: 'error'; reason?: (typeof REFUSALS)[number] }
  | { kind: 'check'; check: UpdateCheck }
  | { kind: 'running' | 'restart' | 'failed'; run: UpdateRun }

/**
 * "Check for updates" in Settings > General. Asks the server (which asks GitHub), offers the
 * newer version with a backup checkbox on by default, then polls the updater until the
 * restarted server reports the new version and reloads the page. A Windows install gets a
 * download link to the new installer instead.
 */
export function UpdateDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' })
  const [backup, setBackup] = useState(true)

  const check = async () => {
    setOpen(true)
    setPhase({ kind: 'checking' })
    try {
      const res = await api.api.update.$get()
      setPhase(res.status === 200 ? { kind: 'check', check: await res.json() } : { kind: 'error' })
    } catch {
      setPhase({ kind: 'error' })
    }
  }

  const start = async () => {
    try {
      const res = await api.api.update.$post({ json: { backup } })
      if (res.status === 202) {
        const { run } = await res.json()
        if (run) setPhase({ kind: 'running', run })
        return
      }
      const { error } = (await res.json()) as { error: string }
      setPhase({ kind: 'error', reason: REFUSALS.find((r) => r === error) })
    } catch {
      setPhase({ kind: 'error' })
    }
  }

  const running = phase.kind === 'running'
  useEffect(() => {
    if (!running) return
    let doneTicks = 0
    // The server is down for a moment while tsx restarts it; failed polls are simply retried.
    const id = setInterval(async () => {
      try {
        const res = await api.api.update.status.$get()
        const { version, run } = await res.json()
        if (!run) return
        if (version === run.target) return window.location.reload()
        if (run.state === 'failed') setPhase({ kind: 'failed', run })
        else if (run.state === 'done' && ++doneTicks >= 5) setPhase({ kind: 'restart', run })
        else setPhase({ kind: 'running', run })
      } catch {
        /* restarting */
      }
    }, 2000)
    return () => clearInterval(id)
  }, [running])

  const backupNote = (run: UpdateRun) =>
    run.backup && (
      <p className="text-sm text-muted-foreground">
        {t('update.backupSaved', { name: run.backup })}
      </p>
    )

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={check}>
        <RefreshCw data-icon="inline-start" />
        {t('update.check')}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !running && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('update.title')}</DialogTitle>
            <DialogDescription>{t('update.privacy')}</DialogDescription>
          </DialogHeader>

          {phase.kind === 'checking' && <p role="status">{t('update.checking')}</p>}
          {phase.kind === 'error' && (
            <p role="alert" className="text-destructive">
              {phase.reason ? t(`update.refused.${phase.reason}`) : t('update.failed')}
            </p>
          )}

          {phase.kind === 'check' && !phase.check.available && (
            <p role="status">{t('update.upToDate', { version: phase.check.current })}</p>
          )}
          {phase.kind === 'check' && phase.check.available && (
            <div className="grid gap-3 text-sm">
              <p>{t('update.available', phase.check)}</p>
              <a
                href={`${REPO}/blob/main/CHANGELOG.md`}
                target="_blank"
                rel="noreferrer"
                className="w-fit text-primary underline"
              >
                {t('update.whatsNew')}
              </a>
              {phase.check.install === 'git' ? (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={backup}
                    onChange={(e) => setBackup(e.target.checked)}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>
                    {t('update.backup')}
                    <span className="block text-muted-foreground">{t('update.backupHint')}</span>
                  </span>
                </label>
              ) : (
                <p className="text-muted-foreground">{t(`update.${phase.check.install}`)}</p>
              )}
            </div>
          )}

          {phase.kind === 'running' && (
            <div className="grid gap-2">
              <p role="status">{t(`update.steps.${phase.run.step}`)}</p>
              <p className="text-sm text-muted-foreground">{t('update.reloadHint')}</p>
              {backupNote(phase.run)}
            </div>
          )}
          {phase.kind === 'restart' && (
            <div className="grid gap-2">
              <p role="status">{t('update.restart', { version: phase.run.target })}</p>
              {backupNote(phase.run)}
            </div>
          )}
          {phase.kind === 'failed' && (
            <div className="grid gap-2">
              <p role="alert" className="text-destructive">
                {t('update.runFailed')}
              </p>
              <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
                {phase.run.error}
              </pre>
              {backupNote(phase.run)}
            </div>
          )}

          <DialogFooter>
            {!running && (
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {phase.kind === 'check' && phase.check.available && phase.check.install !== 'manual'
                  ? t('common.cancel')
                  : t('common.close')}
              </Button>
            )}
            {phase.kind === 'check' && phase.check.available && phase.check.install === 'git' && (
              <Button type="button" onClick={start}>
                {t('update.install', { version: phase.check.latest })}
              </Button>
            )}
            {/* Windows installer (ADR 0008): the new one goes over the old one, the data stays. */}
            {phase.kind === 'check' &&
              phase.check.available &&
              phase.check.install === 'installer' && (
                <Button asChild>
                  <a href={`${REPO}/releases/latest`} target="_blank" rel="noreferrer">
                    {t('update.download', { version: phase.check.latest })}
                  </a>
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
