import { cn } from '@/lib/utils.ts'

const BASE = import.meta.env.BASE_URL

/** The hermit crab. Two raster variants from the brand sheet: one per theme. */
export function Mark({ className }: { className?: string }) {
  return (
    <>
      <img src={`${BASE}brand/mark.png`} alt="" className={cn('dark:hidden', className)} />
      <img
        src={`${BASE}brand/mark-dark.png`}
        alt=""
        className={cn('hidden dark:block', className)}
      />
    </>
  )
}

/** "HR" in orange, "mit" in ink: the wordmark from the brand sheet, set in text so it scales. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-black tracking-tight', className)}>
      <span className="text-brand-dark dark:text-brand">HR</span>
      <span className="text-ink dark:text-foreground">mit</span>
    </span>
  )
}
