import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App.tsx'
import { IS_DEMO } from './config.ts'
import './i18n/index.ts'
import './index.css'
import './theme.ts'

// Demo build only: the import is code-split, so MSW never ships in the local build.
if (IS_DEMO) {
  const { startDemo } = await import('./demo/index.ts')
  // Render even if the service worker cannot register (some embedded browsers block it).
  await startDemo().catch((err: unknown) => console.error('[demo] MSW failed to start', err))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
