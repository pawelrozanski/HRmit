import type { CvContact } from './schemas.ts'

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/
// Runs of digits with spaces, dashes or brackets; 9 to 15 digits keeps years and dates out.
const PHONE_RUN = /\+?\d[\d\s()-]{7,}\d/g
// Two to four capitalised words, letters only: how a CV usually opens.
const NAME_LINE = /^[\p{Lu}][\p{L}'’.-]*(?: [\p{Lu}][\p{L}'’.-]*){1,3}$/u
const NOT_A_NAME = /\b(cv|curriculum|resume|résumé|vitae)\b/i

/**
 * Regex guess at the candidate's contact details, used as the fallback when no local model
 * is available and to double-check what a model returns. Heuristic by design: the recruiter
 * reviews the prefilled form before saving.
 */
export function extractContact(text: string): CvContact {
  const email = text.match(EMAIL)?.[0] ?? ''
  const phone =
    [...text.matchAll(PHONE_RUN)]
      .map((m) => m[0].trim())
      .find((p) => {
        const digits = p.replace(/\D/g, '').length
        return digits >= 9 && digits <= 15
      }) ?? ''
  const line =
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => NAME_LINE.test(l) && !NOT_A_NAME.test(l)) ??
    // No clean name line: two capitalised words at the very start of the text.
    text.trim().match(/^[\p{Lu}][\p{L}'’.-]+ [\p{Lu}][\p{L}'’.-]+(?=\s|$)/u)?.[0]
  const parts = line?.split(' ') ?? []
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' '), email, phone }
}
