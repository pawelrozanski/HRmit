import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const isDemo = process.env.VITE_DEMO === 'true'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // GitHub Pages serves the demo from a sub-path. Locally the app is at the root.
  base: isDemo ? '/HRmit/' : '/',
  server: {
    // Local dev: Vite on 5173 forwards /api to the Hono server on 3000.
    proxy: isDemo ? undefined : { '/api': 'http://127.0.0.1:3000' },
  },
})
