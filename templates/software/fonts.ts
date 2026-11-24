import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Návod
    { name: 'Geist', provider: 'google', weights: [400, 500, 600, 700] },
    { name: 'Geist Mono', provider: 'google', weights: [400, 500] },
    // Magnety
    { name: 'Funnel Display', provider: 'google', weights: [500, 700, 800] },
    { name: 'Funnel Sans', provider: 'google', weights: [400, 500, 600] },
    { name: 'Martian Mono', provider: 'google', weights: [400, 500] },
    // Jeden den
    { name: 'Eczar', provider: 'google', weights: [500, 600, 700] },
    { name: 'Reddit Sans', provider: 'google', weights: [400, 500, 600] },
    { name: 'Reddit Mono', provider: 'google', weights: [400, 500] },
  ],
} satisfies DesignFonts
