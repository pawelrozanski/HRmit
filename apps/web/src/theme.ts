export const THEME_KEY = 'hrmit-theme'
export const THEMES = ['light', 'dark', 'system'] as const
export type Theme = (typeof THEMES)[number]

const media = matchMedia('(prefers-color-scheme: dark)')

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

/** Mirrors the inline script in index.html, which runs before first paint. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme =
    theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // storage unavailable: the choice lasts until reload
  }
  applyTheme(theme)
}

// "System" follows the OS live.
media.addEventListener('change', () => readTheme() === 'system' && applyTheme('system'))
