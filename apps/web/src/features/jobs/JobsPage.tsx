import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Badge } from '@/components/ui/badge.tsx'

export function JobsPage() {
  const { t } = useTranslation()
  const jobs = useApi(() => api.api.jobs.$get().then((r) => r.json()), [])

  if (jobs.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!jobs.data) return <p className="text-muted-foreground">{t('common.loading')}</p>
  if (jobs.data.length === 0) return <p className="text-muted-foreground">{t('jobs.empty')}</p>

  return (
    <>
      <h2 className="mb-4 text-xl font-semibold">{t('jobs.title')}</h2>
      <ul className="grid gap-3">
        {jobs.data.map((job) => (
          <li key={job.id}>
            <Link
              to={`jobs/${job.id}`}
              className="block rounded-lg border bg-card p-4 transition-colors hover:border-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium text-brand-dark">{job.title}</h3>
                <Badge variant={job.status === 'open' ? 'default' : 'outline'}>
                  {t(`jobs.status.${job.status}`)}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
