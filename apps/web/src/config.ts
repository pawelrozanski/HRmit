export const IS_DEMO = import.meta.env.VITE_DEMO === 'true'

/** Where the app routes live: under /demo on GitHub Pages, at the root locally. */
export const APP_PATH = IS_DEMO ? '/demo' : '/'

/** localStorage key of the demo store. "Reset demo" removes it and reloads. */
export const DEMO_STORAGE_KEY = 'hrmit-demo'
