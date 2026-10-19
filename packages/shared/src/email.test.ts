import { expect, test } from 'vitest'
import { renderTemplate } from './email.ts'

test('renderTemplate substitutes known placeholders and leaves unknown ones', () => {
  const out = renderTemplate(
    'Hi {{firstName}} {{firstName}}, re {{jobTitle}} at {{companyName}}. {{jitsiUrl}} {{nope}}',
    { firstName: 'Ada', jobTitle: 'QA', companyName: 'Acme' },
  )
  expect(out).toBe('Hi Ada Ada, re QA at Acme. {{jitsiUrl}} {{nope}}')
  // Values are inserted verbatim; nothing is interpreted.
  expect(renderTemplate('{{lastName}}', { lastName: '<b>x</b>' })).toBe('<b>x</b>')
})
