import type * as Ai from 'ai'
import { afterEach, expect, test, vi } from 'vitest'
import { chatEventSchema, fixtures, type ChatEvent, type ChatRequest } from '@hrmit/shared'
import { chatPrompt } from '../ai/prompts/chat.ts'

// No model in CI: streamText is mocked and fed a scripted fullStream; tools and route are real.
const streamText = vi.fn()
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof Ai>()),
  streamText,
}))
const { app } = await import('../app.ts')

const fetchSpy = vi.spyOn(globalThis, 'fetch')
afterEach(() => {
  fetchSpy.mockReset()
  streamText.mockReset()
  vi.spyOn(console, 'log').mockRestore()
})

const ollamaShow = (capabilities?: string[]) =>
  fetchSpy.mockResolvedValue(new Response(JSON.stringify({ capabilities }), { status: 200 }))

const putSettings = (json: object) =>
  app.request('/api/settings/ai', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(json),
  })

async function chat(body: Partial<ChatRequest>) {
  const res = await app.request('/api/ai/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'What is on tomorrow?' }],
      context: { view: 'dashboard' },
      lang: 'en',
      ...body,
    }),
  })
  return res
}

const events = async (res: Response): Promise<ChatEvent[]> =>
  (await res.text())
    .trim()
    .split('\n')
    .map((line) => chatEventSchema.parse(JSON.parse(line)))

function fakeStream(parts: object[]) {
  streamText.mockImplementation(
    (options: {
      tools: Record<string, { execute: (input: unknown, options: object) => Promise<unknown> }>
    }) => ({
      fullStream: (async function* () {
        for (const part of parts) {
          if ('run' in part && typeof part.run === 'string') {
            // Run the real tool, as the SDK would, so refs are collected.
            await options.tools[part.run]!.execute((part as { input: unknown }).input, {})
            yield { type: 'tool-call', toolName: part.run }
          } else yield part
        }
      })(),
    }),
  )
}

test('streams tool, text, refs and done; the model gets the prompt, history and seven tools', async () => {
  ollamaShow(['completion', 'tools'])
  fakeStream([
    { run: 'upcomingMeetings', input: { days: 1 } },
    { run: 'getCandidate', input: { candidateId: 1 } },
    { type: 'text-delta', text: 'Amelia Hartwell ' },
    { type: 'text-delta', text: 'is in interview.' },
    { type: 'finish' },
  ])
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const res = await chat({})
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('application/x-ndjson')
  const ev = await events(res)
  expect(ev.map((e) => e.type)).toEqual(['tool', 'tool', 'text', 'text', 'refs', 'done'])
  expect(ev[0]).toEqual({ type: 'tool', name: 'upcomingMeetings' })
  const refs = ev.find((e) => e.type === 'refs')
  expect(refs?.type === 'refs' && refs.refs.candidates['1']).toEqual({
    name: 'Amelia Hartwell',
    jobId: 1,
  })

  const call = streamText.mock.calls[0]![0]
  expect(Object.keys(call.tools).sort()).toEqual([
    'getCandidate',
    'getRecruitment',
    'listRecruitments',
    'searchCandidates',
    'stuckCandidates',
    'teamOverview',
    'upcomingMeetings',
  ])
  expect(call.messages).toEqual([{ role: 'user', content: 'What is on tomorrow?' }])
  expect(call.system).toContain('never judge')
  expect(call.system).toContain('looking at the dashboard')
  expect(call.system).toContain('Answer in English')
  // The log line names tools and timing, never the question or an answer.
  const line = String(log.mock.calls.at(-1)?.[0])
  expect(line).toContain('"tools":["upcomingMeetings","getCandidate"]')
  expect(line).not.toContain('tomorrow')
  expect(line).not.toContain('Amelia')
})

test('cloud provider: names typed by the recruiter are scrubbed from the history', async () => {
  await putSettings({ provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'm' })
  fakeStream([{ type: 'text-delta', text: 'ok' }])
  const amelia = fixtures.candidates[0]!
  const res = await chat({
    messages: [
      {
        role: 'user',
        content: `Summarize ${amelia.firstName} ${amelia.lastName}, ${amelia.email}`,
      },
      { role: 'assistant', content: 'Candidate #1 is in interview.' },
      { role: 'user', content: `And ${amelia.lastName}'s phone ${amelia.phone}?` },
    ],
    context: { view: 'candidate', id: 1 },
    lang: 'pl',
  })
  expect(res.status).toBe(200)
  const { messages, system } = streamText.mock.calls[0]![0]
  expect(messages[0].content).toBe('Summarize Candidate #1, [email]')
  expect(messages[2].content).toBe("And Candidate #1's phone [phone]?")
  expect(messages[1].content).toBe('Candidate #1 is in interview.')
  expect(system).toContain('candidateId 1')
  expect(system).toContain('Answer in Polish')
  await putSettings({
    provider: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b-instruct',
  })
})

test('Ollama without tool support answers 422 no_tools; Ollama down answers 502', async () => {
  ollamaShow(['completion'])
  const res = await chat({})
  expect(res.status).toBe(422)
  expect(await res.json()).toEqual({ error: 'no_tools' })
  expect(streamText).not.toHaveBeenCalled()

  fetchSpy.mockRejectedValue(new TypeError('fetch failed'))
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const down = await chat({})
  expect(down.status).toBe(502)
  expect((await down.json()).error).toBe('fetch failed')
  warn.mockRestore()
})

test('a model error mid-stream becomes an error event, tool errors map to no_tools', async () => {
  ollamaShow(['completion', 'tools'])
  fakeStream([{ type: 'error', error: new Error('registry.ollama.ai/x does not support tools') }])
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const ev = await events(await chat({}))
  expect(ev).toEqual([{ type: 'error', error: 'no_tools' }, { type: 'done' }])
  warn.mockRestore()
  expect((await chat({ messages: [] })).status).toBe(400)
})

test('the system prompt states the rules in every language and context', () => {
  for (const lang of ['en', 'pl'] as const) {
    const p = chatPrompt(lang, { view: 'recruitment', id: 3 })
    expect(p).toMatch(/never judge/)
    expect(p).toMatch(/Do not rank, score, compare or recommend/)
    expect(p).toMatch(/decision belongs to the recruiter/)
    expect(p).toMatch(/Read only/)
    expect(p).toMatch(/found no data/)
    expect(p).toContain('jobId 3')
  }
  expect(chatPrompt('en', { view: 'other' })).not.toContain('undefined')
})
