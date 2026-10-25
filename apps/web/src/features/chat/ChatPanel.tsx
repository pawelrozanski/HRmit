import {
  chatEventSchema,
  isLocalProvider,
  type AiLang,
  type ChatContext,
  type ChatEvent,
} from '@hrmit/shared'
import { MessageSquare, RotateCcw, Send } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { APP_ROOT, IS_DEMO } from '@/config.ts'
import { readBlind } from '../candidates/BlindContext.ts'
import { useChat, type ChatMessage, type Proposal } from './ChatState.tsx'
import { segments } from './chatText.ts'
import { ProposalCard } from './ProposalCard.tsx'

/** Suggested questions per screen, as i18n keys under chat.chips. */
const CHIPS: Record<ChatContext['view'], string[]> = {
  dashboard: ['today', 'longest', 'teamIt', 'best'],
  recruitment: ['thisRecruitment', 'requirements', 'longestHere', 'best'],
  candidate: ['summarize', 'scorecard', 'noteSummary', 'meetings'],
  employee: ['employeeNotes', 'employeeRole'],
  other: ['today', 'recruitments', 'teamIt', 'best'],
}

/** Read the NDJSON answer line by line; each line is one chatEventSchema event. */
async function* events(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) if (line.trim()) yield chatEventSchema.parse(JSON.parse(line))
  }
}

/**
 * The assistant panel (ADR 0007): a side sheet available on every page. Questions go to
 * POST /api/ai/chat with the screen context; the answer streams in. Pseudonyms are swapped
 * for names only here, from the refs the server sends for the UI.
 */
export function ChatPanel() {
  const { t, i18n } = useTranslation()
  const chat = useChat()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [tool, setTool] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const settings = useApi(() => api.api.settings.ai.$get().then((r) => r.json()), [chat.open])
  const isLocal = settings.data ? isLocalProvider(settings.data) : null

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [chat.messages, tool])

  const ask = async (text: string) => {
    const content = text.trim()
    if (!content || busy) return
    const lang: AiLang = i18n.language.startsWith('pl') ? 'pl' : 'en'
    const history: ChatMessage[] = [...chat.messages, { role: 'user', content }]
    chat.setMessages(() => [...history, { role: 'assistant', content: '' }])
    setDraft('')
    setBusy(true)
    setError(null)
    input.current?.focus()
    const append = (delta: string) =>
      chat.setMessages((m) => {
        const last = m.at(-1)!
        return [...m.slice(0, -1), { ...last, content: last.content + delta }]
      })
    try {
      const res = await api.api.ai.chat.$post({
        json: { messages: history, context: chat.screen, lang },
      })
      if (res.status !== 200 || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      for await (const e of events(res.body)) {
        if (e.type === 'tool') setTool(e.name)
        else if (e.type === 'text') {
          setTool(null)
          append(e.text)
        } else if (e.type === 'proposal') {
          setTool(null)
          chat.setMessages((m) => {
            const last = m.at(-1)!
            return [
              ...m.slice(0, -1),
              { ...last, proposals: [...(last.proposals ?? []), { draft: e.proposal }] },
            ]
          })
        } else if (e.type === 'refs') chat.addRefs(e.refs)
        else if (e.type === 'error') throw new Error(e.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      // An empty assistant bubble would be confusing: drop it, keep the question.
      chat.setMessages((m) =>
        m.at(-1)?.content === '' && !m.at(-1)?.proposals?.length ? m.slice(0, -1) : m,
      )
    } finally {
      setTool(null)
      setBusy(false)
      input.current?.focus()
    }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void ask(draft)
    }
  }

  const errorText =
    error === 'no_tools'
      ? t('chat.errors.noTools')
      : error
        ? t('chat.errors.failed', { error })
        : null

  return (
    <Sheet open={chat.open} onOpenChange={chat.setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" aria-hidden="true" />
            {t('chat.title')}
            {isLocal !== null && (
              <Badge variant="outline">{t(isLocal ? 'chat.local' : 'chat.cloud')}</Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {IS_DEMO
              ? t('chat.demoHint')
              : isLocal === false
                ? t('chat.cloudHint')
                : t('chat.hint')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {chat.messages.length === 0 ? (
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">{t('chat.empty')}</p>
              <div className="flex flex-wrap gap-2">
                {CHIPS[chat.screen.view].map((key) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => ask(t(`chat.chips.${key}`))}
                  >
                    {t(`chat.chips.${key}`)}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="grid gap-3" aria-label={t('chat.title')}>
              {chat.messages.map((m, i) => (
                <li
                  key={i}
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] justify-self-end rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground'
                      : 'max-w-[95%] rounded-lg border bg-card px-3 py-2 text-sm whitespace-pre-wrap'
                  }
                  // The last assistant message is the one being streamed: read it when done.
                  aria-live={
                    m.role === 'assistant' && i === chat.messages.length - 1 ? 'polite' : undefined
                  }
                >
                  {m.role === 'user' ? (
                    m.content
                  ) : (
                    <>
                      <Answer text={m.content} onNavigate={() => chat.setOpen(false)} />
                      {m.proposals?.map((p, j) => (
                        <ProposalCard
                          key={j}
                          proposal={p}
                          onNavigate={() => chat.setOpen(false)}
                          onChange={(next: Proposal) =>
                            chat.setMessages((all) =>
                              all.map((msg, k) =>
                                k === i
                                  ? {
                                      ...msg,
                                      proposals: msg.proposals!.map((q, l) => (l === j ? next : q)),
                                    }
                                  : msg,
                              ),
                            )
                          }
                        />
                      ))}
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
          {(tool || (busy && chat.messages.at(-1)?.content === '')) && (
            <p className="mt-2 text-xs text-muted-foreground" role="status">
              {tool ? t(`chat.tools.${tool}`) : t('chat.thinking')}
            </p>
          )}
          {errorText && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {errorText}{' '}
              {(error === 'no_tools' ||
                error?.startsWith('HTTP 5') ||
                /fetch|ECONNREFUSED|connect/i.test(error ?? '')) && (
                <Link
                  to={`${APP_ROOT}/settings/ai`}
                  onClick={() => chat.setOpen(false)}
                  className="font-medium underline"
                >
                  {t('chat.errors.settings')}
                </Link>
              )}
            </p>
          )}
          <div ref={bottom} />
        </div>

        <form
          className="grid gap-2 border-t p-4"
          onSubmit={(e) => {
            e.preventDefault()
            void ask(draft)
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            {t('chat.inputLabel')}
          </label>
          <Textarea
            id="chat-input"
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={t('chat.placeholder')}
            rows={2}
            className="min-h-10"
            disabled={busy}
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || chat.messages.length === 0}
              onClick={() => {
                chat.reset()
                setError(null)
                input.current?.focus()
              }}
            >
              <RotateCcw data-icon="inline-start" /> {t('chat.new')}
            </Button>
            <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
              <Send data-icon="inline-start" /> {t('chat.send')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('chat.disclaimer')}</p>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/** Answer text with pseudonyms replaced and candidates / recruitments as navigation buttons. */
function Answer({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const { t } = useTranslation()
  const { refs } = useChat()
  const navigate = useNavigate()
  const go = (to: string) => {
    onNavigate()
    navigate(to)
  }
  const linkClass =
    'inline rounded px-0.5 font-medium text-primary underline underline-offset-2 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'
  return (
    <>
      {segments(text, refs, readBlind()).map((s, i) =>
        s.kind === 'text' ? (
          <span key={i}>{s.text}</span>
        ) : (
          <button
            key={i}
            type="button"
            className={linkClass}
            title={t(
              s.kind === 'candidate'
                ? 'chat.openCandidate'
                : s.kind === 'employee'
                  ? 'chat.openEmployee'
                  : 'chat.openRecruitment',
            )}
            onClick={() =>
              go(
                s.kind === 'candidate'
                  ? `${APP_ROOT}/recruitments/${s.jobId}?candidate=${s.id}`
                  : s.kind === 'employee'
                    ? `${APP_ROOT}/employees?open=${s.id}`
                    : `${APP_ROOT}/recruitments/${s.id}`,
              )
            }
          >
            {s.label}
          </button>
        ),
      )}
    </>
  )
}
