import { setupWorker } from 'msw/browser'
import { handlers } from './handlers.ts'

export async function startDemo() {
  await setupWorker(...handlers).start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
  })
}
