/** Input of buildIcs: everything the invite needs, nothing the mail does not already carry. */
export type IcsEvent = {
  uid: string
  summary: string
  description: string
  /** ISO 8601 instant; the file is written in UTC. */
  startsAt: string
  durationMin: number
  url: string
  organizerEmail: string
  attendeeEmail: string
}

/** 2026-10-20T08:00:00.000Z -> 20261020T080000Z (RFC 5545 §3.3.5, form 2). */
const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newline are escaped in TEXT values. */
const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

const utf8Len = (ch: string) => {
  const c = ch.codePointAt(0) ?? 0
  return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4
}

/** RFC 5545 §3.1: lines longer than 75 octets continue on the next line after a single space. */
function fold(line: string): string {
  const out: string[] = []
  let cur = ''
  let len = 0
  for (const ch of line) {
    const n = utf8Len(ch)
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      len = 0
    }
    cur += ch
    len += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

/** A hand-built VCALENDAR with one VEVENT invitation (docs/ARCHITECTURE.md §6). No dependency. */
export function buildIcs(e: IcsEvent): string {
  const start = new Date(e.startsAt)
  const end = new Date(start.getTime() + e.durationMin * 60_000)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HRmit//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.summary)}`,
    `DESCRIPTION:${esc(e.description)}`,
    `LOCATION:${esc(e.url)}`,
    `URL:${e.url}`,
    `ORGANIZER:mailto:${e.organizerEmail}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${e.attendeeEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}
