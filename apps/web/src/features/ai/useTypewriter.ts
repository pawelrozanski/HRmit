import { useEffect, useState } from 'react'

const CHARS_PER_TICK = 3
const TICK_MS = 16

/**
 * Reveals `parts` progressively, one running counter across all of them, so a list types
 * out in order. With `animate` false (stored results) or prefers-reduced-motion, everything
 * shows at once. Works the same for real and demo responses: it only sees the final text.
 */
export function useTypewriter(parts: string[], animate: boolean): string[] {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const [shown, setShown] = useState(animate ? 0 : total)
  const key = parts.join('\u0000')

  useEffect(() => {
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(total)
      return
    }
    setShown(0)
    const id = setInterval(
      () =>
        setShown((n) => {
          if (n + CHARS_PER_TICK >= total) clearInterval(id)
          return Math.min(total, n + CHARS_PER_TICK)
        }),
      TICK_MS,
    )
    return () => clearInterval(id)
  }, [key, animate, total])

  let rest = shown
  return parts.map((p) => {
    const visible = p.slice(0, Math.max(0, rest))
    rest -= p.length
    return visible
  })
}
