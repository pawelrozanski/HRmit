import { createTransport } from 'nodemailer'
import { getSmtpSettings } from '../settings.ts'

export class SmtpNotConfigured extends Error {}

/** Error text safe for the UI, the DB row and the log: no password, no stack, no URL credentials. */
export function sanitize(err: unknown, pass: string | null): string {
  let msg = (err instanceof Error ? err.message : String(err)).split('\n')[0] ?? ''
  if (pass) msg = msg.replaceAll(pass, '[redacted]')
  msg = msg.replace(/(https?:\/\/)[^/\s@]+@/g, '$1[redacted]@')
  return msg.slice(0, 300) || 'Unknown error'
}

/**
 * Send one plain-text email with the stored SMTP settings. Plain text only: a template value such
 * as a candidate's name is never interpreted as HTML by the recipient's client.
 * Throws SmtpNotConfigured when host or from is missing; other failures come back sanitized.
 * ponytail: a transport per call, no pooling; add caching if someone sends hundreds a minute.
 */
export type Attachment = { filename: string; content: string; contentType: string }

export async function sendMail(
  to: string,
  subject: string,
  text: string,
  attachments: Attachment[] = [],
): Promise<void> {
  const s = await getSmtpSettings()
  if (!s.host || !s.from) throw new SmtpNotConfigured('SMTP is not configured')
  const transport = createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: s.user ? { user: s.user, pass: s.pass ?? '' } : undefined,
  })
  try {
    await transport.sendMail({
      from: s.companyName ? { name: s.companyName, address: s.from } : s.from,
      to,
      subject,
      text,
      attachments,
    })
  } catch (err) {
    throw new Error(sanitize(err, s.pass))
  }
}
