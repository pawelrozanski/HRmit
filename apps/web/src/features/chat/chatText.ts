import type { ChatRefs } from '@hrmit/shared'

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'candidate'; id: number; jobId: number; label: string }
  | { kind: 'recruitment'; id: number; label: string }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Split an answer into plain text and links. "Candidate #14" / "Kandydat #14" (any Polish
 * ending) becomes the person's name from the refs, unless blind screening is on; a name the
 * model wrote itself (local provider) is linked too. "recruitment #3" / "rekrutacja #3" and a
 * known recruitment title become links to the pipeline. The refs come from the server for the
 * UI only; the model never saw the names behind the pseudonyms with a cloud provider.
 */
export function segments(text: string, refs: ChatRefs, blind: boolean): Segment[] {
  const names = Object.entries(refs.candidates).filter(([, c]) => c.name)
  const titles = Object.entries(refs.recruitments).filter(([, r]) => r.title)
  const alternatives = [
    '(?<cLabel>(?:candidate|kandydat\\p{L}*)\\s?#(?<cId>\\d+))',
    '(?<rLabel>(?:recruitment|rekrutacj\\p{L}*|job)\\s?#(?<rId>\\d+))',
    ...(blind ? [] : names.map(([id, c]) => `(?<n${id}>${escape(c.name)})`)),
    ...titles.map(([id, r]) => `(?<t${id}>${escape(r.title)})`),
  ]
  const re = new RegExp(alternatives.join('|'), 'giu')
  const out: Segment[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    const g = m.groups ?? {}
    let seg: Segment | null = null
    if (g.cId !== undefined) {
      const id = Number(g.cId)
      const ref = refs.candidates[id]
      // Without a ref there is nothing to link; the label stays as the model wrote it.
      if (ref) seg = { kind: 'candidate', id, jobId: ref.jobId, label: blind ? m[0] : ref.name }
    } else if (g.rId !== undefined) {
      const id = Number(g.rId)
      const ref = refs.recruitments[id]
      if (ref) seg = { kind: 'recruitment', id, label: ref.title }
    } else {
      const hit = Object.entries(g).find(([k, v]) => v !== undefined && /^[nt]\d+$/.test(k))
      if (hit) {
        const id = Number(hit[0].slice(1))
        seg =
          hit[0][0] === 'n'
            ? { kind: 'candidate', id, jobId: refs.candidates[id]!.jobId, label: m[0] }
            : { kind: 'recruitment', id, label: m[0] }
      }
    }
    if (!seg) continue
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) })
    out.push(seg)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}
