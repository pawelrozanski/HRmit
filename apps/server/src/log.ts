/**
 * docs/ARCHITECTURE.md §7: JSON lines on stdout, with secret-looking fields redacted.
 * Request bodies are never passed here; only what a log line needs.
 */
const SECRET_FIELD = /apikey|pass|authorization|secret|token/i

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET_FIELD.test(k) ? '[redacted]' : redact(v)]),
    )
  return value
}

type Level = 'info' | 'warn' | 'error'
const write =
  (level: Level) =>
  (msg: string, fields: Record<string, unknown> = {}) =>
    console[level === 'info' ? 'log' : level](
      JSON.stringify({ time: new Date().toISOString(), level, msg, ...(redact(fields) as object) }),
    )

export const log = { info: write('info'), warn: write('warn'), error: write('error') }
