import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

const REPO = 'https://github.com/pawelrozanski/HRmit'

export function Landing() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 p-12 text-center">
      {/* logo placeholder: hermit crab */}
      <div className="size-24 rounded-full bg-brand" aria-hidden="true" />
      <h1 className="text-4xl font-bold text-brand-dark">HRmit</h1>
      <p className="text-lg">{t('tagline')}</p>
      <div className="flex gap-4">
        <Link
          to="/demo"
          className="rounded bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
        >
          {t('landing.tryDemo')}
        </Link>
        <a href={REPO} className="rounded border border-ink px-4 py-2 hover:text-brand-dark">
          GitHub
        </a>
      </div>
    </main>
  )
}
