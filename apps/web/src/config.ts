export const IS_DEMO = import.meta.env.VITE_DEMO === 'true'

/** Where the app routes live: under /demo on GitHub Pages, at the root locally. */
export const APP_PATH = IS_DEMO ? '/demo' : '/'
