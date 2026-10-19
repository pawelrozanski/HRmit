import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { LanguageSwitch } from '../components/LanguageSwitch.tsx'
import { Button } from '@/components/ui/button.tsx'

const REPO = 'https://github.com/pawelrozanski/HRmit'
const DOCS = `${REPO}/tree/main/docs`
const FEATURES = ['local', 'assist', 'fair'] as const
const RUN_LOCALLY = `git clone ${REPO}.git
cd HRmit
pnpm install
pnpm dev
# open http://localhost:5173`

export function Landing() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-8 p-8 text-center sm:p-12">
      <div className="self-end">
        <LanguageSwitch />
      </div>
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-28" />
      <h1 className="text-4xl font-bold text-brand-dark">HRmit</h1>
      <p className="text-xl">{t('tagline')}</p>
      <p className="max-w-xl text-muted-foreground">{t('landing.lead')}</p>
      <div className="flex gap-4">
        <Button asChild size="lg">
          <Link to="/demo">{t('landing.tryDemo')}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href={REPO}>GitHub</a>
        </Button>
      </div>
      <ul className="mt-4 grid gap-4 text-left sm:grid-cols-3">
        {FEATURES.map((key) => (
          <li key={key} className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold text-brand-dark">{t(`landing.features.${key}.title`)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(`landing.features.${key}.text`)}
            </p>
          </li>
        ))}
      </ul>
      <section className="max-w-xl">
        <h2 className="font-semibold text-brand-dark">{t('landing.demo.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('landing.demo.text')}</p>
      </section>
      <section className="w-full max-w-xl text-left">
        <h2 className="text-center font-semibold text-brand-dark">{t('landing.run.title')}</h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">{t('landing.run.text')}</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-ink p-4 text-sm text-white">
          <code>{RUN_LOCALLY}</code>
        </pre>
      </section>
      <p className="text-xs text-muted-foreground">
        {t('landing.openSource')}{' '}
        <a href={REPO} className="text-brand-dark underline">
          GitHub
        </a>
        {' · '}
        <a href={DOCS} className="text-brand-dark underline">
          {t('landing.docs')}
        </a>
      </p>
    </main>
  )
}
