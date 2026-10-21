import type { Job } from '@hrmit/shared'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { JobForm } from './JobForm.tsx'

export function JobsPage() {
  const { t } = useTranslation()
  const jobs = useApi(() => api.api.jobs.$get().then((r) => r.json()), [])
  // null: closed; undefined: "new job"; a job: editing it.
  const [editing, setEditing] = useState<Job | undefined | null>(null)

  const saved = (job: Job) => {
    jobs.setData((list) =>
      list.some((j) => j.id === job.id)
        ? list.map((j) => (j.id === job.id ? job : j))
        : [...list, job],
    )
    setEditing(null)
  }

  if (jobs.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!jobs.data) return <p className="text-muted-foreground">{t('common.loading')}</p>

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('jobs.title')}</h2>
        <Button onClick={() => setEditing(undefined)}>
          <Plus data-icon="inline-start" /> {t('jobs.new')}
        </Button>
      </div>
      {jobs.data.length === 0 && <p className="text-muted-foreground">{t('jobs.empty')}</p>}
      <ul className="grid gap-3">
        {jobs.data.map((job) => (
          <li key={job.id} className="relative">
            <Link
              to={`jobs/${job.id}`}
              className="block rounded-lg border bg-card p-4 transition-colors hover:border-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-3 pr-10">
                <h3 className="font-medium text-primary">{job.title}</h3>
                <Badge variant={job.status === 'open' ? 'default' : 'outline'}>
                  {t(`jobs.status.${job.status}`)}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>
            </Link>
            {/* Outside the link: a button inside <a> is invalid HTML and breaks keyboard focus. */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3"
              aria-label={t('jobs.edit')}
              onClick={() => setEditing(job)}
            >
              <Pencil />
            </Button>
          </li>
        ))}
      </ul>
      <JobForm
        key={editing?.id ?? 'new'}
        job={editing ?? undefined}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={saved}
      />
    </>
  )
}
