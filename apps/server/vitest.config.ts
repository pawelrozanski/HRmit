import { defineProject } from 'vitest/config'

export default defineProject({
  test: { name: 'server', environment: 'node', env: { HRMIT_DATA_DIR: ':memory:' } },
})
