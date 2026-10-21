import { useTranslation } from 'react-i18next'
import { Route, Routes } from 'react-router'
import { DemoBanner } from './components/DemoBanner.tsx'
import { IS_DEMO } from './config.ts'
import { Home } from './pages/Home.tsx'
import { Landing } from './pages/Landing.tsx'

export function App() {
  const { t } = useTranslation()
  return (
    <>
      {/* First focusable element on every page; <main id="main" tabIndex={-1}> receives focus. */}
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t('nav.skip')}
      </a>
      {IS_DEMO && <DemoBanner />}
      <Routes>
        {IS_DEMO ? (
          <>
            <Route path="/" element={<Landing />} />
            <Route path="/demo/*" element={<Home />} />
          </>
        ) : (
          <Route path="/*" element={<Home />} />
        )}
      </Routes>
    </>
  )
}
