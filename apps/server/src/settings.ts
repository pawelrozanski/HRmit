import { eq } from 'drizzle-orm'
import { AI_SETTINGS_DEFAULTS, type AiSettings } from '@hrmit/shared'
import { db } from './db/index.ts'
import { settings } from './db/schema.ts'
import { decrypt, encrypt } from './security/secrets.ts'

/** docs/ARCHITECTURE.md §3: these keys are encrypted at rest and never returned by the API. */
const SECRET_KEYS = new Set(['ai.apiKey', 'smtp.pass'])

/** Decrypted value for server-side use only. Route handlers must never put a secret in a response. */
export async function getSetting(key: string): Promise<string | undefined> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key))
  if (!row) return undefined
  return SECRET_KEYS.has(key) ? decrypt(row.value) : row.value
}

/** null removes the row. */
export async function setSetting(key: string, value: string | null): Promise<void> {
  if (value === null) {
    await db.delete(settings).where(eq(settings.key, key))
    return
  }
  const stored = SECRET_KEYS.has(key) ? encrypt(value) : value
  await db
    .insert(settings)
    .values({ key, value: stored })
    .onConflictDoUpdate({ target: settings.key, set: { value: stored } })
}

/** AI settings with the decrypted key, for the provider factory. Defaults fill missing rows. */
export async function getAiSettings(): Promise<AiSettings & { apiKey: string | null }> {
  const [provider, baseUrl, model, apiKey] = await Promise.all(
    ['ai.provider', 'ai.baseUrl', 'ai.model', 'ai.apiKey'].map(getSetting),
  )
  return {
    provider: (provider as AiSettings['provider']) ?? AI_SETTINGS_DEFAULTS.provider,
    baseUrl: baseUrl ?? AI_SETTINGS_DEFAULTS.baseUrl,
    model: model ?? AI_SETTINGS_DEFAULTS.model,
    apiKey: apiKey ?? null,
  }
}
