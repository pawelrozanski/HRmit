import { useTranslation } from 'react-i18next'

export function DemoBanner() {
  const { t } = useTranslation()
  return (
    <div role="status" className="bg-brand-dark px-4 py-2 text-center text-sm text-white">
      {t('demo.banner')}
    </div>
  )
}
