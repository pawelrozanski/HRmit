import type { PipelineStage } from '@hrmit/shared'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge.tsx'
import { cn } from '@/lib/utils.ts'

/**
 * One colour per stage (tokens in index.css), always next to the stage's name, never instead
 * of it. Full class strings so Tailwind sees them.
 */
export const STAGE_STYLE: Record<PipelineStage, { badge: string; tint: string; edge: string }> = {
  applied: {
    badge: 'border-stage-applied/50 bg-stage-applied/10 text-stage-applied',
    tint: 'bg-stage-applied/25',
    edge: 'border-t-stage-applied',
  },
  screening: {
    badge: 'border-stage-screening/50 bg-stage-screening/10 text-stage-screening',
    tint: 'bg-stage-screening/25',
    edge: 'border-t-stage-screening',
  },
  interview: {
    badge: 'border-stage-interview/50 bg-stage-interview/10 text-stage-interview',
    tint: 'bg-stage-interview/25',
    edge: 'border-t-stage-interview',
  },
  offer: {
    badge: 'border-stage-offer/50 bg-stage-offer/10 text-stage-offer',
    tint: 'bg-stage-offer/25',
    edge: 'border-t-stage-offer',
  },
  rejected: {
    badge: 'border-stage-rejected/50 bg-stage-rejected/10 text-stage-rejected',
    tint: 'bg-stage-rejected/25',
    edge: 'border-t-stage-rejected',
  },
}

export function StageBadge({ stage, className }: { stage: PipelineStage; className?: string }) {
  const { t } = useTranslation()
  return (
    <Badge variant="outline" className={cn(STAGE_STYLE[stage].badge, className)}>
      {t(`stage.${stage}`)}
    </Badge>
  )
}
