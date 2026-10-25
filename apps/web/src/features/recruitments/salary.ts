import type { Job } from '@hrmit/shared'

/** "14 000–19 000 PLN", "from 14 000 PLN", "up to 19 000 PLN", or null when no range is set. */
export function salaryRange(
  job: Pick<Job, 'salaryMin' | 'salaryMax' | 'salaryCurrency'>,
  lang: string,
): string | null {
  const n = (v: number) => new Intl.NumberFormat(lang).format(v)
  const { salaryMin: min, salaryMax: max, salaryCurrency: cur } = job
  const pl = lang.startsWith('pl')
  if (min !== null && max !== null)
    return min === max ? `${n(min)} ${cur}` : `${n(min)}–${n(max)} ${cur}`
  if (min !== null) return `${pl ? 'od' : 'from'} ${n(min)} ${cur}`
  if (max !== null) return `${pl ? 'do' : 'up to'} ${n(max)} ${cur}`
  return null
}
