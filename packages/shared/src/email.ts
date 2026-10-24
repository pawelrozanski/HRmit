/** Placeholders a template may use. Unknown ones are left untouched so a typo stays visible. */
export type TemplateVars = Partial<
  Record<
    | 'firstName'
    | 'lastName'
    | 'jobTitle'
    | 'companyName'
    | 'jitsiUrl'
    | 'startsAt'
    | 'lang'
    | 'today',
    string
  >
>

/**
 * Substitute {{name}} placeholders. Plain text in, plain text out: emails are sent as text/plain,
 * so a value containing "<script>" is just characters in the recipient's mail client.
 */
export function renderTemplate(text: string, vars: TemplateVars): string {
  let out = text
  for (const [k, v] of Object.entries(vars))
    if (v !== undefined) out = out.replaceAll(`{{${k}}}`, v)
  return out
}
