import { expect, test } from 'vitest'
import { anonymize, isLocalBaseUrl, isValidPesel } from './anonymize.ts'
import { isLocalProvider } from './aiProviders.ts'

const lukasz = {
  id: 7,
  firstName: 'Łukasz',
  lastName: 'Lis',
  email: 'lukasz.lis@example.com',
  phone: '+48 600 000 107',
}

test('names: diacritics-tolerant, case-insensitive, whole words only', () => {
  const { text, replacements } = anonymize(
    'Łukasz Lis\nLUKASZ, lis@ Lista zadań, Lisowski. Kontakt: Lukasz',
    lukasz,
  )
  expect(text).toBe(
    'Candidate #7\nCandidate #7, Candidate #7@ Lista zadań, Lisowski. Kontakt: Candidate #7',
  )
  expect(replacements).toEqual([{ kind: 'name', count: 4 }])
})

test('structured email and phone in several spellings', () => {
  const { text, replacements } = anonymize(
    'Mail: Lukasz.Lis@Example.com, tel. 600-000-107 lub +48 (600) 000 107',
    lukasz,
  )
  expect(text).toBe('Mail: [email], tel. [phone] lub [phone]')
  expect(replacements).toEqual([
    { kind: 'email', count: 1 },
    { kind: 'phone', count: 2 },
  ])
})

test('regex passes: other emails, phones, URLs, PESEL with a valid checksum, birth date, address', () => {
  const input = [
    'Referencje: anna.k@firma.pl, 22 123 45 67, +1 415 555 0199',
    'Profil: https://linkedin.com/in/ktos oraz github.com/ktos',
    'PESEL: 44051401359 (valid), 44051401358 (invalid)',
    'Data urodzenia: 14.05.1944',
    'ul. Długa 5, 00-001 Warszawa',
    'Doświadczenie 2020 - 2022, WCAG 2.1',
  ].join('\n')
  const { text, replacements } = anonymize(input, lukasz)
  expect(text).toBe(
    [
      'Referencje: [email], [phone], [phone]',
      'Profil: [url] oraz [url]',
      'PESEL: [pesel] (valid), 44051401358 (invalid)',
      'Data urodzenia: [date of birth]',
      '[address]',
      'Doświadczenie 2020 - 2022, WCAG 2.1',
    ].join('\n'),
  )
  expect(replacements).toEqual([
    { kind: 'email', count: 1 },
    { kind: 'url', count: 2 },
    { kind: 'pesel', count: 1 },
    { kind: 'phone', count: 2 },
    { kind: 'birthDate', count: 1 },
    { kind: 'address', count: 1 },
  ])
  expect(isValidPesel('44051401359')).toBe(true)
  expect(isValidPesel('44051401358')).toBe(false)
})

test('a job description without personal data passes through unchanged', () => {
  const job =
    'Build and maintain the recruiter-facing panel. React, TypeScript, accessibility. Hybrid, Warsaw or remote within the EU.'
  expect(anonymize(job, lukasz)).toEqual({ text: job, replacements: [] })
})

test('isLocalBaseUrl and isLocalProvider', () => {
  for (const u of [
    'http://localhost:11434/v1',
    'http://127.0.0.1:1234/v1',
    'http://[::1]:8080/v1',
    'http://10.0.0.5/v1',
    'http://172.20.1.1/v1',
    'http://192.168.1.10:1234/v1',
    'http://mac-mini.local:1234/v1',
  ])
    expect(isLocalBaseUrl(u), u).toBe(true)
  for (const u of ['https://api.openai.com/v1', 'http://172.32.0.1/v1', 'not a url', ''])
    expect(isLocalBaseUrl(u), u).toBe(false)
  expect(isLocalProvider({ provider: 'ollama', baseUrl: 'https://remote.example' })).toBe(true)
  expect(isLocalProvider({ provider: 'anthropic', baseUrl: 'http://localhost/v1' })).toBe(false)
  expect(isLocalProvider({ provider: 'lmstudio', baseUrl: 'https://remote.example' })).toBe(true)
  expect(isLocalProvider({ provider: 'groq', baseUrl: 'http://localhost/v1' })).toBe(false)
  expect(isLocalProvider({ provider: 'custom', baseUrl: 'http://localhost:1234/v1' })).toBe(true)
  expect(isLocalProvider({ provider: 'custom', baseUrl: 'https://openrouter.ai/api/v1' })).toBe(
    false,
  )
  // Databases from before 0.3.3 stored 'openai-compatible' for what is now 'custom'.
  expect(
    isLocalProvider({ provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1' }),
  ).toBe(true)
})

test('without a candidate only the pattern passes run (job descriptions)', () => {
  const r = anonymize('Contact hiring@example.com or +48 600 000 123. Warsaw team.')
  expect(r.text).toBe('Contact [email] or [phone]. Warsaw team.')
  expect(r.text).not.toContain('Candidate #')
})
