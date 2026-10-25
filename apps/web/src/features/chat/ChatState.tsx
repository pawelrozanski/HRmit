import type {
  CandidateNote,
  ChatContext,
  ChatProposal,
  ChatRefs,
  EmployeeNote,
} from '@hrmit/shared'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/** A drafted note and what the recruiter did with it (ADR 0009). */
export type Proposal = {
  draft: ChatProposal
  saved?: CandidateNote | EmployeeNote
  dismissed?: boolean
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  /** Raw text as the model wrote it (pseudonyms included); names are substituted at render. */
  content: string
  /** Note drafts the model proposed in this turn; nothing is stored until Save is clicked. */
  proposals?: Proposal[]
}

type State = {
  open: boolean
  setOpen: (open: boolean) => void
  /** What is on screen; pages set it, the panel sends it with every question. */
  screen: ChatContext
  setScreen: (screen: ChatContext) => void
  messages: ChatMessage[]
  setMessages: (update: (m: ChatMessage[]) => ChatMessage[]) => void
  /** Every ref received in this conversation, merged: names and link targets for the UI. */
  refs: ChatRefs
  addRefs: (refs: ChatRefs) => void
  reset: () => void
}

const EMPTY_REFS: ChatRefs = { candidates: {}, recruitments: {}, employees: {} }
const Ctx = createContext<State | null>(null)

/**
 * The conversation lives here, above the router, so it survives moving between pages and
 * closing the panel. Nothing is persisted: a reload is a new conversation (ADR 0007).
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<ChatContext>({ view: 'other' })
  const [messages, setMessagesState] = useState<ChatMessage[]>([])
  const [refs, setRefs] = useState<ChatRefs>(EMPTY_REFS)
  const value: State = {
    open,
    setOpen,
    screen,
    setScreen,
    messages,
    setMessages: (update) => setMessagesState(update),
    refs,
    addRefs: (r) =>
      setRefs((prev) => ({
        candidates: { ...prev.candidates, ...r.candidates },
        recruitments: { ...prev.recruitments, ...r.recruitments },
        employees: { ...prev.employees, ...r.employees },
      })),
    reset: () => {
      setMessagesState([])
      setRefs(EMPTY_REFS)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useChat(): State {
  const s = useContext(Ctx)
  if (!s) throw new Error('useChat outside ChatProvider')
  return s
}

/** A page declares what it shows; on unmount the context goes back to "other". */
export function useScreen(screen: ChatContext) {
  const { setScreen } = useChat()
  useEffect(() => {
    setScreen(screen)
    return () => setScreen({ view: 'other' })
  }, [screen.view, screen.id])
}
