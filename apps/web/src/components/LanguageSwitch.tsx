import { useTranslation } from 'react-i18next'

const LANGS = ['en', 'pl'] as const

export function LanguageSwitch() {
  const { i18n } = useTranslation()
  return (
    <div className="flex gap-2 text-sm">
      {LANGS.map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => i18n.changeLanguage(lng)}
          aria-pressed={i18n.resolvedLanguage === lng}
          className="rounded px-2 py-1 uppercase aria-pressed:bg-brand aria-pressed:text-white hover:text-brand-dark"
        >
          {lng}
        </button>
      ))}
    </div>
  )
}
