import { useTranslation } from 'react-i18next'
import { DEMO_STORAGE_KEY } from '../config.ts'

function resetDemo() {
  try {
    localStorage.removeItem(DEMO_STORAGE_KEY)
  } catch {
    // storage unavailable: a reload already starts from fixtures
  }
  location.reload()
}

export function DemoBanner() {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-4 bg-brand-dark px-4 py-2 text-center text-sm text-white"
    >
      <span>{t('demo.banner')}</span>
      <button type="button" onClick={resetDemo} className="underline hover:no-underline">
        {t('demo.reset')}
      </button>
    </div>
  )
}
