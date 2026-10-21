export const IS_DEMO = import.meta.env.VITE_DEMO === 'true'

/** Where the app routes live: under /demo on GitHub Pages, at the root locally. */
export const APP_PATH = IS_DEMO ? '/demo' : '/'

/** APP_PATH without the trailing slash, for absolute links such as `${APP_ROOT}/teams/1`. */
export const APP_ROOT = APP_PATH.replace(/\/$/, '')

/** localStorage key of the demo store. "Reset demo" removes it and reloads. */
export const DEMO_STORAGE_KEY = 'hrmit-demo'
