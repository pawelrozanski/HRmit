import { readdirSync } from 'node:fs'
import { crc32, deflateRawSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { candidateSchema } from '@hrmit/shared'
import { app } from '../app.ts'
import { uploadsDir } from '../db/index.ts'

const json = (method: string, path: string, body: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const upload = (id: number, name: string, bytes: Uint8Array) => {
  const form = new FormData()
  form.append('file', new File([bytes], name))
  return app.request(`/api/candidates/${id}/cv`, { method: 'POST', body: form })
}

const files = () => readdirSync(uploadsDir)

// --- fixtures generated in the test, so no binaries live in git ----------------------------

/** The smallest PDF that draws one line of text. Offsets are computed, so the xref is valid. */
function tinyPdf(text: string): Uint8Array {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    (() => {
      const stream = `BT /F1 12 Tf 10 50 Td (${text}) Tj ET`
      return `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    })(),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(out)
}

/** A ZIP with deflated entries: enough of the OOXML package for mammoth to find the body. */
function zip(entries: Record<string, string>): Uint8Array {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const [name, content] of Object.entries(entries)) {
    const raw = Buffer.from(content)
    const data = deflateRawSync(raw)
    const n = Buffer.from(name)
    const common = Buffer.alloc(26)
    common.writeUInt16LE(20, 0) // version needed
    common.writeUInt16LE(8, 4) // method: deflate
    common.writeUInt32LE(crc32(raw), 10)
    common.writeUInt32LE(data.length, 14)
    common.writeUInt32LE(raw.length, 18)
    common.writeUInt16LE(n.length, 22)
    const local = Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), common, n, data])
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    common.copy(central, 6)
    central.writeUInt32LE(offset, 42)
    locals.push(local)
    centrals.push(Buffer.concat([central, n]))
    offset += local.length
  }
  const cd = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(locals.length, 8)
  end.writeUInt16LE(locals.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(offset, 16)
  return new Uint8Array(Buffer.concat([...locals, cd, end]))
}

const tinyDocx = (text: string) =>
  zip({
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  })

// --- routes ---------------------------------------------------------------------------------

test('PATCH /api/candidates/:id/stage moves the candidate and stamps the change', async () => {
  const before = Date.now()
  const res = await json('PATCH', '/api/candidates/1/stage', { stage: 'interview' })
  expect(res.status).toBe(200)
  const moved = candidateSchema.parse(await res.json())
  expect(moved.stage).toBe('interview')
  expect(Date.parse(moved.stageChangedAt)).toBeGreaterThanOrEqual(before)

  const list = candidateSchema
    .array()
    .parse(await (await app.request('/api/jobs/1/candidates?stage=interview')).json())
  expect(list.some((c) => c.id === 1)).toBe(true)
})

test('PATCH rejects unknown stages and unknown candidates', async () => {
  expect((await json('PATCH', '/api/candidates/1/stage', { stage: 'hired' })).status).toBe(400)
  expect((await json('PATCH', '/api/candidates/9999/stage', { stage: 'offer' })).status).toBe(404)
})

test('POST and PUT /api/candidates validate and persist', async () => {
  const input = { jobId: 1, firstName: 'Ada', lastName: 'Byron', email: 'ada@example.com' }
  const created = await json('POST', '/api/candidates', input)
  expect(created.status).toBe(201)
  const c = candidateSchema.parse(await created.json())
  expect(c).toMatchObject({ ...input, stage: 'applied', phone: '', cvFilename: null })
  expect('cvPath' in c).toBe(false)

  expect((await json('POST', '/api/candidates', { ...input, email: 'nope' })).status).toBe(400)

  const updated = await json('PUT', `/api/candidates/${c.id}`, {
    ...input,
    notes: 'Called back',
    stage: 'screening',
  })
  const u = candidateSchema.parse(await updated.json())
  expect(u.notes).toBe('Called back')
  expect(Date.parse(u.stageChangedAt)).toBeGreaterThan(Date.parse(c.stageChangedAt) - 1)
  expect((await json('PUT', '/api/candidates/9999', input)).status).toBe(404)
})

test('CV upload: real PDF and DOCX are stored under a UUID and their text extracted', async () => {
  const before = files().length
  const pdf = await upload(2, 'Résumé.pdf', tinyPdf('Hello from PDF'))
  expect(pdf.status).toBe(200)
  const c = candidateSchema.parse(await pdf.json())
  expect(c.cvFilename).toBe('Résumé.pdf')
  expect(c.cvText).toContain('Hello from PDF')
  expect(files().length).toBe(before + 1)
  expect(files().some((f) => f.includes('Résumé'))).toBe(false)

  // download: by id, original name in the header, path never exposed
  const dl = await app.request('/api/candidates/2/cv')
  expect(dl.status).toBe(200)
  expect(dl.headers.get('content-type')).toBe('application/pdf')
  expect(dl.headers.get('content-disposition')).toContain("filename*=UTF-8''R%C3%A9sum%C3%A9.pdf")
  expect(new TextDecoder().decode(await dl.arrayBuffer()).startsWith('%PDF-')).toBe(true)

  // second upload replaces the first file on disk
  const docx = await upload(2, 'cv.docx', tinyDocx('Hello from DOCX'))
  expect(docx.status).toBe(200)
  expect(candidateSchema.parse(await docx.json()).cvText).toContain('Hello from DOCX')
  expect(files().length).toBe(before + 1)
})

test('CV upload rejects disguised and oversized files, and unknown candidates', async () => {
  const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]) // "MZ" header
  expect((await upload(3, 'malware.pdf', exe)).status).toBe(415)
  expect((await upload(3, 'cv.docx', zip({ 'a.txt': 'not a docx' }))).status).toBe(415)
  expect((await upload(3, 'cv.txt', new TextEncoder().encode('plain'))).status).toBe(415)
  expect((await upload(3, 'big.pdf', new Uint8Array(10 * 1024 * 1024 + 1))).status).toBe(413)
  expect((await upload(9999, 'cv.pdf', tinyPdf('x'))).status).toBe(404)
  expect((await app.request('/api/candidates/3/cv')).status).toBe(404)
})

test('a broken PDF still uploads, with empty text', async () => {
  const res = await upload(4, 'broken.pdf', new TextEncoder().encode('%PDF-1.4 garbage'))
  expect(res.status).toBe(200)
  expect(candidateSchema.parse(await res.json()).cvText).toBe('')
})

test('DELETE /api/candidates/:id removes the row and the file', async () => {
  await upload(5, 'cv.pdf', tinyPdf('bye'))
  const stored = files()
  expect((await app.request('/api/candidates/5', { method: 'DELETE' })).status).toBe(204)
  expect((await app.request('/api/candidates/5/cv')).status).toBe(404)
  expect(files().length).toBe(stored.length - 1)
  const list = candidateSchema
    .array()
    .parse(await (await app.request('/api/jobs/1/candidates')).json())
  expect(list.some((c) => c.id === 5)).toBe(false)
  expect((await app.request('/api/candidates/5', { method: 'DELETE' })).status).toBe(404)
})
