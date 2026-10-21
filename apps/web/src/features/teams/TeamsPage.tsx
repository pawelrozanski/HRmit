import { Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Placeholder: multi-user teams are tracked in docs/ROADMAP.md under "out of MVP". */
export function TeamsPage() {
  const { t } = useTranslation()
  return (
    <>
      <h2 className="mb-4 text-xl font-semibold">{t('teams.title')}</h2>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card p-10 text-center">
        <Users className="size-8 text-primary" aria-hidden="true" />
        <p className="font-medium">{t('teams.soon')}</p>
        <p className="max-w-md text-sm text-muted-foreground">{t('teams.text')}</p>
      </div>
    </>
  )
}
