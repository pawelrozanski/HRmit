import { cn } from 'cn'
import {
  siAnthropic,
  siDeepseek,
  siGooglegemini,
  siLmstudio,
  siMistralai,
  siOllama,
  siOpenrouter,
  siPerplexity,
  type SimpleIcon,
} from 'simple-icons'

/** simple-icons (CC0) has a logo for these; the rest get a two-letter monogram. */
const ICONS: Record<string, SimpleIcon> = {
  ollama: siOllama,
  lmstudio: siLmstudio,
  anthropic: siAnthropic,
  google: siGooglegemini,
  mistral: siMistralai,
  deepseek: siDeepseek,
  perplexity: siPerplexity,
  openrouter: siOpenrouter,
}
// Only brand colors with at least 3:1 against both cream and ink; the rest use currentColor.
const BRAND_COLOR = new Set(['google', 'mistral', 'deepseek'])
const MONOGRAM: Record<string, string> = {
  openai: 'OA',
  groq: 'Gq',
  together: 'TA',
  fireworks: 'FW',
  xai: 'xA',
  custom: '…',
}

/** Square tile with the provider's logo or monogram. Decorative: the name is always next to it. */
export function ProviderLogo({ id, className }: { id: string; className?: string }) {
  const icon = ICONS[id]
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-lg border border-brand/40 bg-brand/5 text-foreground',
        className,
      )}
    >
      {icon ? (
        <svg
          viewBox="0 0 24 24"
          className="size-7"
          fill={BRAND_COLOR.has(id) ? `#${icon.hex}` : 'currentColor'}
        >
          <path d={icon.path} />
        </svg>
      ) : (
        <span className="text-base font-semibold text-brand-dark dark:text-brand">
          {MONOGRAM[id] ?? id.slice(0, 2)}
        </span>
      )}
    </span>
  )
}
