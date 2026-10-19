import { fileURLToPath } from 'node:url'
import { configDefaults, defineProject } from 'vitest/config'

export default defineProject({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Playwright owns e2e/; vitest must not pick up demo.spec.ts.
  test: { name: 'web', environment: 'node', exclude: [...configDefaults.exclude, 'e2e/**'] },
})
