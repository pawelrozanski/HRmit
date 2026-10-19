import type { jobInputSchema } from '@hrmit/shared'
import type { TFunction } from 'i18next'

// zod is not a direct dependency of the web app; take the issue type from a shared schema.
type Issue = NonNullable<ReturnType<typeof jobInputSchema.safeParse>['error']>['issues'][number]

/** Field name -> translated message, from zod issues. Enough for required-or-email forms. */
export function fieldErrors(issues: Issue[], t: TFunction): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '')
    out[field] ??= issue.code === 'invalid_format' ? t('form.invalidEmail') : t('form.required')
  }
  return out
}
