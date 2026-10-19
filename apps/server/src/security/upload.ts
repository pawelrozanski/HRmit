import { extname } from 'node:path'
import mammoth from 'mammoth'
import { extractText as unpdfExtract } from 'unpdf'

export const MAX_CV_BYTES = 10 * 1024 * 1024

export type CvExt = 'pdf' | 'docx'
export const CV_MIME: Record<CvExt, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

/**
 * docs/ARCHITECTURE.md §7: allowlist by extension AND magic bytes, 10 MB limit.
 * Returns the detected type, or a short error code the UI can translate.
 */
export function validateCv(name: string, bytes: Uint8Array): CvExt | 'too_large' | 'bad_type' {
  if (bytes.byteLength > MAX_CV_BYTES) return 'too_large'
  const ext = extname(name).toLowerCase()
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (ext === '.pdf' && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf'
  // DOCX: a ZIP (local file header "PK\3\4") whose directory names a word/ part.
  if (
    ext === '.docx' &&
    buf.length > 4 &&
    buf.readUInt32LE(0) === 0x04034b50 &&
    buf.includes('word/')
  )
    return 'docx'
  return 'bad_type'
}

/** Plain text for the AI stages. Any parser failure yields '' and the upload still succeeds. */
export async function extractCvText(ext: CvExt, bytes: Uint8Array): Promise<string> {
  try {
    if (ext === 'pdf') {
      const { text } = await unpdfExtract(bytes, { mergePages: true })
      return text.trim()
    }
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    return value.trim()
  } catch {
    return ''
  }
}
