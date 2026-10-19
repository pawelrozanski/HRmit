import { expect, test } from 'vitest'
import { buildIcs } from './ics.ts'

const base = {
  uid: 'abc@hrmit',
  summary: 'Interview: QA at Acme; Warsaw, remote',
  description: 'Hello Ada,\nJoin: https://meet.jit.si/hrmit-x\\n',
  startsAt: '2026-10-20T08:30:00.000Z',
  durationMin: 90,
  url: 'https://meet.jit.si/hrmit-x',
  organizerEmail: 'hr@example.test',
  attendeeEmail: 'ada@example.test',
}

test('buildIcs: UTC stamps, DTEND arithmetic, escaping, CRLF', () => {
  const ics = buildIcs(base)
  const lines = ics.split('\r\n')
  expect(lines).toContain('DTSTART:20261020T083000Z')
  expect(lines).toContain('DTEND:20261020T100000Z')
  expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/)
  expect(lines).toContain('METHOD:REQUEST')
  expect(lines).toContain('SUMMARY:Interview: QA at Acme\\; Warsaw\\, remote')
  expect(lines).toContain('DESCRIPTION:Hello Ada\\,\\nJoin: https://meet.jit.si/hrmit-x\\\\n')
  expect(lines).toContain('ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:ada@example.test')
  expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  expect(ics).not.toMatch(/[^\r]\n/)
})

test('buildIcs: folds at 75 octets without splitting a multi-byte character', () => {
  const ics = buildIcs({ ...base, description: 'ą'.repeat(100) })
  const lines = ics.split('\r\n')
  for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
  expect(lines.some((l) => l.startsWith(' '))).toBe(true)
  // Unfolding (RFC 5545 §3.1) gives the original line back.
  expect(ics.replace(/\r\n /g, '')).toContain(`DESCRIPTION:${'ą'.repeat(100)}`)
})
