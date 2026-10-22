import { expect, test } from 'vitest'
import { AI_PROVIDERS, getProvider, normalizeProviderId } from './aiProviders.ts'

test('catalog: unique ids, valid base URLs, custom last, local providers need no key', () => {
  const ids = AI_PROVIDERS.map((p) => p.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const p of AI_PROVIDERS) {
    expect(() => new URL(p.baseUrl), p.id).not.toThrow()
    if (p.local) expect(p.keyUrl, p.id).toBeUndefined()
    else if (p.id !== 'custom') expect(p.keyUrl, p.id).toMatch(/^https:/)
  }
  expect(ids.at(-1)).toBe('custom')
  expect(getProvider('openai-compatible').id).toBe('custom')
  expect(getProvider('nope').id).toBe('custom')
  expect(normalizeProviderId('ollama')).toBe('ollama')
})
