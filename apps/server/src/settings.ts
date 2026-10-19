import { eq } from 'drizzle-orm'
import {
  AI_SETTINGS_DEFAULTS,
  SMTP_SETTINGS_DEFAULTS,
  type AiSettings,
  type SmtpSettings,
} from '@hrmit/shared'
import { db } from './db/index.ts'
import { log } from './log.ts'
import { settings } from './db/schema.ts'
import { decrypt, encrypt } from './security/secrets.ts'

/** docs/ARCHITECTURE.md §3: these keys are encrypted at rest and never returned by the API. */
const SECRET_KEYS = new Set(['ai.apiKey', 'smtp.pass'])

/** Decrypted value for server-side use only. Route handlers must never put a secret in a response. */
export async function getSetting(key: string): Promise<string | undefined> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key))
  if (!row) return undefined
  if (!SECRET_KEYS.has(key)) return row.value
  try {
    return decrypt(row.value)
  } catch {
    // A replaced master.key cannot open the old blob: behave as if no key were stored.
    log.warn('secret could not be decrypted, treating as unset', { key })
    return undefined
  }
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
    // OLLAMA_BASE_URL: the container default, where localhost is not the host machine.
    baseUrl: baseUrl ?? process.env.OLLAMA_BASE_URL ?? AI_SETTINGS_DEFAULTS.baseUrl,
    model: model ?? AI_SETTINGS_DEFAULTS.model,
    apiKey: apiKey ?? null,
  }
}

/** SMTP settings with the decrypted password, for the mail transport. Defaults fill missing rows. */
export async function getSmtpSettings(): Promise<SmtpSettings & { pass: string | null }> {
  const [host, port, secure, user, pass, from, companyName] = await Promise.all(
    ['host', 'port', 'secure', 'user', 'pass', 'from', 'companyName'].map((k) =>
      getSetting(`smtp.${k}`),
    ),
  )
  const d = SMTP_SETTINGS_DEFAULTS
  return {
    host: host ?? d.host,
    port: port ? Number(port) : d.port,
    secure: secure ? secure === 'true' : d.secure,
    user: user ?? d.user,
    pass: pass ?? null,
    from: from ?? d.from,
    companyName: companyName ?? d.companyName,
  }
}
