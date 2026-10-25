import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import { PIPELINE_STAGES, type Candidate, type PipelineStage } from '@hrmit/shared'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils.ts'
import { useBlind } from '../candidates/BlindContext.ts'
import { candidateName } from '../candidates/candidateName.ts'

type Props = {
  candidates: Candidate[]
  onOpen: (c: Candidate) => void
  onMove: (c: Candidate, stage: PipelineStage) => void
}

/**
 * Keep the dragged card inside the board (its scrollable ancestor): without this a card can be
 * dragged anywhere on the page. Same arithmetic as @dnd-kit/modifiers restrictToParentElement,
 * inlined rather than adding a package for eight lines.
 */
const keepOnBoard: Modifier = ({ transform, draggingNodeRect, scrollableAncestorRects }) => {
  const bounds = scrollableAncestorRects[0]
  if (!draggingNodeRect || !bounds) return transform
  const next = { ...transform }
  if (draggingNodeRect.top + transform.y <= bounds.top) next.y = bounds.top - draggingNodeRect.top
  else if (draggingNodeRect.bottom + transform.y >= bounds.bottom)
    next.y = bounds.bottom - draggingNodeRect.bottom
  if (draggingNodeRect.left + transform.x <= bounds.left)
    next.x = bounds.left - draggingNodeRect.left
  else if (draggingNodeRect.right + transform.x >= bounds.right)
    next.x = bounds.right - draggingNodeRect.right
  return next
}

/** Five columns, one per stage. Drag a card to move it; the candidate's page has a keyboard fallback. */
export function KanbanBoard({ candidates, onOpen, onMove }: Props) {
  // 5px of movement before a drag starts, so a plain click still opens the candidate's page.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const candidate = candidates.find((c) => c.id === active.id)
    const stage = over?.id as PipelineStage | undefined
    if (candidate && stage && stage !== candidate.stage) onMove(candidate, stage)
  }

  return (
    <DndContext sensors={sensors} modifiers={[keepOnBoard]} onDragEnd={handleDragEnd}>
      <div className="grid auto-cols-[minmax(11rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            candidates={candidates.filter((c) => c.stage === stage)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </DndContext>
  )
}

function Column({
  stage,
  candidates,
  onOpen,
}: {
  stage: PipelineStage
  candidates: Candidate[]
  onOpen: (c: Candidate) => void
}) {
  const { t } = useTranslation()
  const { isOver, setNodeRef } = useDroppable({ id: stage })
  return (
    <section
      ref={setNodeRef}
      aria-label={t(`stage.${stage}`)}
      className={cn(
        'flex min-h-40 flex-col gap-2 rounded-lg border bg-muted/40 p-2 transition-colors',
        isOver && 'border-brand bg-brand/10',
      )}
    >
      <h3 className="flex items-center justify-between px-1 text-sm font-semibold">
        {t(`stage.${stage}`)}
        <span className="text-muted-foreground font-normal">{candidates.length}</span>
      </h3>
      {candidates.map((c) => (
        <Card key={c.id} candidate={c} onOpen={onOpen} />
      ))}
    </section>
  )
}

function Card({ candidate, onOpen }: { candidate: Candidate; onOpen: (c: Candidate) => void }) {
  const { t } = useTranslation()
  const blind = useBlind()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpen(candidate)}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
      className={cn(
        'cursor-grab rounded-md border bg-card px-3 py-2 text-left text-sm font-medium shadow-xs hover:border-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        isDragging && 'z-10 cursor-grabbing opacity-80 shadow-md',
      )}
      {...listeners}
      {...attributes}
    >
      {candidateName(candidate, blind, t)}
    </button>
  )
}
