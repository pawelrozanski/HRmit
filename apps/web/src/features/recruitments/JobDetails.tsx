import type { Job } from '@hrmit/shared'
import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button.tsx'
import { salaryRange } from './salary.ts'

type Props = { job: Job; teamName?: string; onEdit: () => void }

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

/** Everything the offer says about the position (0.6.1); edited through the recruitment form. */
export function JobDetails({ job, teamName, onEdit }: Props) {
  const { t, i18n } = useTranslation()
  const salary = salaryRange(job, i18n.language)
  const dash = <span className="text-muted-foreground">{t('recruitments.notSet')}</span>
  const facts: [string, ReactNode][] = [
    [t('recruitments.levelLabel'), job.level ? t(`recruitments.level.${job.level}`) : dash],
    [
      t('recruitments.salaryLabel'),
      salary ? `${salary} ${t(`recruitments.period.${job.salaryPeriod}`)}` : dash,
    ],
    [t('recruitments.locationLabel'), job.location || dash],
    [t('recruitments.contractLabel'), job.contract || dash],
    [t('recruitments.teamLabel'), teamName ?? t('recruitments.noTeam')],
    [t('recruitments.statusLabel'), t(`recruitments.status.${job.status}`)],
  ]
  const list = (title: string, text: string) => (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="mb-2 font-medium">{title}</h3>
      {lines(text).length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {lines(text).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('recruitments.notSet')}</p>
      )}
    </section>
  )

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={onEdit}>
          <Pencil data-icon="inline-start" /> {t('recruitments.edit')}
        </Button>
      </div>
      <dl className="grid gap-x-6 gap-y-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-4 md:grid-cols-2">
        {list(t('recruitments.requirementsLabel'), job.requirements)}
        {list(t('recruitments.niceToHaveLabel'), job.niceToHave)}
      </div>
      <section className="rounded-lg border bg-card p-4">
        <h3 className="mb-2 font-medium">{t('recruitments.descriptionLabel')}</h3>
        <p className="text-sm whitespace-pre-line">{job.description || t('recruitments.notSet')}</p>
      </section>
    </div>
  )
}
