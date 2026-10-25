import { expect, test } from 'vitest'
import { segments } from './chatText.ts'

const refs = {
  candidates: { 1: { name: 'Amelia Hartwell', jobId: 1 }, 8: { name: 'Samuel Okonkwo', jobId: 2 } },
  employees: {},
  recruitments: { 1: { title: 'Frontend Developer (React)' } },
}

test('pseudonyms become names and links, recruitments become links', () => {
  const out = segments('Candidate #1 and Kandydata #8 are in recruitment #1.', refs, false)
  expect(out).toEqual([
    { kind: 'candidate', id: 1, jobId: 1, label: 'Amelia Hartwell' },
    { kind: 'text', text: ' and ' },
    { kind: 'candidate', id: 8, jobId: 2, label: 'Samuel Okonkwo' },
    { kind: 'text', text: ' are in ' },
    { kind: 'recruitment', id: 1, label: 'Frontend Developer (React)' },
    { kind: 'text', text: '.' },
  ])
})

test('blind screening keeps the pseudonym and never links a written name', () => {
  const out = segments('Kandydat #1 (Amelia Hartwell) waits.', refs, true)
  expect(out[0]).toEqual({ kind: 'candidate', id: 1, jobId: 1, label: 'Kandydat #1' })
  expect(out[1]).toEqual({ kind: 'text', text: ' (Amelia Hartwell) waits.' })
})

test('names and titles written by a local model are linked; unknown ids stay text', () => {
  const out = segments(
    'Amelia Hartwell applied to Frontend Developer (React). Candidate #99.',
    refs,
    false,
  )
  expect(out.map((s) => s.kind)).toEqual(['candidate', 'text', 'recruitment', 'text'])
  expect(out.at(-1)).toEqual({ kind: 'text', text: '. Candidate #99.' })
  expect(segments('', refs, false)).toEqual([])
  expect(segments('plain', { candidates: {}, recruitments: {}, employees: {} }, false)).toEqual([
    { kind: 'text', text: 'plain' },
  ])
})
