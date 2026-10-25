/**
 * docs/ARCHITECTURE.md §5.2 and ADR 0005: scrub a candidate's text locally before any cloud
 * call. Pure and deterministic, so it runs the same on the server and in the demo browser.
 * It is a heuristic, not named-entity recognition: names that appear only in the CV body
 * (references, former managers) can slip through, and the UI says so.
 */

export type ReplacementKind = 'name' | 'email' | 'phone' | 'url' | 'pesel' | 'birthDate' | 'address'
export type Replacement = { kind: ReplacementKind; count: number }
export type AnonymizeResult = { text: string; replacements: Replacement[] }
export type AnonymizeCandidate = {
  id: number
  firstName: string
  lastName: string
  email: string
  phone: string
}

/** Letters NFD does not decompose but that people still type without the stroke. */
const STROKES: Record<string, string> = { ł: 'l', Ł: 'L', ø: 'o', Ø: 'O', đ: 'd', Đ: 'D' }
const foldChar = (ch: string) =>
  (STROKES[ch] ?? ch).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const fold = (s: string) => [...s].map(foldChar).join('')
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Replace whole-word matches of `pattern` (a regex source written against folded text:
 * lowercase, no diacritics) while keeping the rest of the original text byte for byte.
 */
function replaceFolded(text: string, pattern: string, replacement: string) {
  let folded = ''
  const offsets: number[] = []
  for (let i = 0; i < text.length;) {
    const cp = text.codePointAt(i)!
    const ch = String.fromCodePoint(cp)
    for (const f of foldChar(ch)) {
      folded += f
      offsets.push(i)
    }
    i += ch.length
  }
  offsets.push(text.length)
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'gu')
  let out = ''
  let last = 0
  let count = 0
  for (const m of folded.matchAll(re)) {
    const start = offsets[m.index]!
    const end = offsets[m.index + m[0].length]!
    out += text.slice(last, start) + replacement
    last = end
    count++
  }
  return { text: out + text.slice(last), count }
}

function replaceAll(text: string, re: RegExp, replacement: string) {
  let count = 0
  const out = text.replace(re, () => (count++, replacement))
  return { text: out, count }
}

/** Weights from the PESEL specification; the 11th digit is the check digit. */
const PESEL_WEIGHTS = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]
export function isValidPesel(s: string): boolean {
  if (!/^\d{11}$/.test(s)) return false
  const sum = PESEL_WEIGHTS.reduce((acc, w, i) => acc + w * Number(s[i]), 0)
  return (10 - (sum % 10)) % 10 === Number(s[10])
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const URL_RE =
  /(?:https?:\/\/|www\.)[^\s<>"')]+|\b[\w-]+\.(?:com|pl|org|net|io|dev|eu)\b(?:\/[^\s<>"')]*)?/gi
// International (+48 600 000 100), Polish mobile (600-000-100) and landline (22 123 45 67).
const PHONE =
  /\+\d{1,3}(?:[\s.-]?\d){7,12}\b|\b\d{3}[\s.-]?\d{3}[\s.-]?\d{3}\b|\b\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g
const DATE =
  /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+\p{L}+\s+\d{4}\b/gu
const BIRTH_LINE = /^.*(?:birth|born|urodz|\bur\.).*$/gimu
// A Polish postcode (NN-NNN) or a street marker makes the whole line an address line.
const ADDRESS_LINE =
  /^.*(?:\b\d{2}-\d{3}\b|\b(?:ul|al|os|pl)\.\s|\b(?:ulica|aleja|osiedle)\s).*$/gimu

/** Digits only, so "+48 600-000-100" and "600 000 100" both match the stored phone. */
const phonePattern = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  return digits.length < 6 ? null : `\\+?${digits.split('').join('[\\s.()-]*')}`
}

export type AnonymizeOptions = {
  /**
   * Also match inflected forms of the name ("Amelię", "Hartwella"): the stem without its last
   * letter plus up to three letters, for names of five letters or more; a four-letter name keeps
   * its last letter and takes up to three more ("Theo" must not eat "the", found in the 0.6.0
   * review). Meant for the recruiter's own words and for notes in the chat, where Polish
   * declension is the norm; CV text keeps exact matching.
   */
  inflected?: boolean
  /** The pseudonym that replaces the name; default `Candidate #<id>`, `Employee #<id>` for staff. */
  label?: string
}

const namePattern = (name: string, inflected: boolean) => {
  const folded = fold(name.trim())
  if (!folded) return ''
  if (!inflected || folded.length < 4) return escape(folded)
  const stem = folded.length >= 5 ? folded.slice(0, -1) : folded
  return `${escape(stem)}\\p{L}{0,3}`
}

/** Without a candidate (job text) only the pattern passes run: there are no fields to match. */
export function anonymize(
  text: string,
  candidate?: AnonymizeCandidate,
  options: AnonymizeOptions = {},
): AnonymizeResult {
  const counts: Partial<Record<ReplacementKind, number>> = {}
  const add = (kind: ReplacementKind, count: number) => {
    if (count) counts[kind] = (counts[kind] ?? 0) + count
  }
  let r = { text, count: 0 }

  // 1. Structured fields: email and phone first (an email often contains the name), then the
  // full name and each part on its own.
  if (candidate) {
    const label = options.label ?? `Candidate #${candidate.id}`
    const first = namePattern(candidate.firstName, options.inflected ?? false)
    const last = namePattern(candidate.lastName, options.inflected ?? false)
    r = replaceFolded(text, escape(fold(candidate.email.trim())), '[email]')
    add('email', r.count)
    const phone = phonePattern(candidate.phone)
    if (phone) {
      r = replaceAll(r.text, new RegExp(phone, 'g'), '[phone]')
      add('phone', r.count)
    }
    for (const pattern of [`${first}\\s+${last}|${last}\\s+${first}`, first, last]) {
      if (!pattern) continue
      r = replaceFolded(r.text, pattern, label)
      add('name', r.count)
    }
  }

  // 2. Regex passes for whatever else looks personal. Order matters: emails before URLs
  // (an address contains a domain), PESEL before phones (eleven digits look like both).
  r = replaceAll(r.text, EMAIL, '[email]')
  add('email', r.count)
  r = replaceAll(r.text, URL_RE, '[url]')
  add('url', r.count)
  let pesel = 0
  r.text = r.text.replace(/\b\d{11}\b/g, (m) => (isValidPesel(m) ? (pesel++, '[pesel]') : m))
  add('pesel', pesel)
  r = replaceAll(r.text, PHONE, '[phone]')
  add('phone', r.count)
  let birth = 0
  r.text = r.text.replace(BIRTH_LINE, (line) =>
    line.replace(DATE, () => (birth++, '[date of birth]')),
  )
  add('birthDate', birth)
  r = replaceAll(r.text, ADDRESS_LINE, '[address]')
  add('address', r.count)

  return {
    text: r.text,
    replacements: Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([kind, count]) => ({ kind: kind as ReplacementKind, count })),
  }
}

/** Loopback, private-range and .local hosts: the data does not leave the machine or the LAN. */
export function isLocalBaseUrl(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase()
  } catch {
    return false
  }
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}
