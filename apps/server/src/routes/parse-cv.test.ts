import { expect, test, vi } from 'vitest'
import { AI_SETTINGS_DEFAULTS, cvImportSchema } from '@hrmit/shared'
import { tinyPdf } from '../test/cv-files.ts'

// No Ollama in CI: the model call is mocked, parsing and the fallback are real.
const generateObject = vi.fn()
vi.mock('ai', () => ({ generateText: vi.fn(), generateObject }))
const { app } = await import('../app.ts')

const parse = (name: string, bytes: Uint8Array<ArrayBuffer>) => {
  const form = new FormData()
  form.append('file', new File([bytes], name))
  return app.request('/api/ai/parse-cv', { method: 'POST', body: form })
}
const putSettings = (json: object) =>
  app.request('/api/settings/ai', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(json),
  })
// tinyPdf draws one short line on a 200pt page (longer text is clipped). The heuristic sees
// the email and phone, the mocked model supplies the name.
const CV = tinyPdf('Okafor nadia@ex.io 600000199')

test('parse-cv with a local model merges its answer with the regex fields', async () => {
  generateObject.mockResolvedValueOnce({
    object: { firstName: 'Nadia', lastName: 'Okafor', email: '', phone: '600000199' },
  })
  const res = await parse('cv.pdf', CV)
  expect(res.status).toBe(200)
  const result = cvImportSchema.parse(await res.json())
  expect(result.source).toBe('ai')
  expect(result.fields).toEqual({
    firstName: 'Nadia',
    lastName: 'Okafor',
    email: 'nadia@ex.io',
    phone: '600000199',
  })
  expect(result.cvText).toContain('Okafor')
  expect(generateObject.mock.calls[0]?.[0].prompt).toContain('nadia@ex.io')
})

test('parse-cv falls back to the heuristic when the model fails', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  generateObject.mockRejectedValueOnce(new Error('connection refused'))
  const result = cvImportSchema.parse(await (await parse('cv.pdf', CV)).json())
  expect(result.source).toBe('heuristic')
  expect(result.fields.email).toBe('nadia@ex.io')
})

test('parse-cv never sends the raw CV to a cloud provider', async () => {
  await putSettings({ provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'm' })
  generateObject.mockClear()
  const result = cvImportSchema.parse(await (await parse('cv.pdf', CV)).json())
  expect(result.source).toBe('heuristic')
  expect(generateObject).not.toHaveBeenCalled()
  await putSettings(AI_SETTINGS_DEFAULTS)
})

test('parse-cv rejects disguised files and files without text', async () => {
  expect((await parse('cv.pdf', new Uint8Array([0x4d, 0x5a, 0x90]))).status).toBe(415)
  expect((await parse('cv.pdf', tinyPdf(''))).status).toBe(422)
})

test('parse-cv drops a model-invented spelling of the name in favour of the text', async () => {
  generateObject.mockResolvedValueOnce({
    object: { firstName: 'Nadia', lastName: 'Okpara', email: '', phone: '' },
  })
  const result = cvImportSchema.parse(await (await parse('cv.pdf', tinyPdf('Nadia Okafor'))).json())
  expect(result.fields).toMatchObject({ firstName: 'Nadia', lastName: 'Okafor' })
})
