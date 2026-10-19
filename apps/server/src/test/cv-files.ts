import { crc32, deflateRawSync } from 'node:zlib'

// --- fixtures generated in the test, so no binaries live in git ----------------------------

/** The smallest PDF that draws one line of text. Offsets are computed, so the xref is valid. */
export function tinyPdf(text: string): Uint8Array<ArrayBuffer> {
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
export function zip(entries: Record<string, string>): Uint8Array<ArrayBuffer> {
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

export const tinyDocx = (text: string) =>
  zip({
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  })
