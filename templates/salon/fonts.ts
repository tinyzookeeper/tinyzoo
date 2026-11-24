import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Zrcadlo
    { name: 'Tenor Sans', provider: 'google', weights: [400] },
    { name: 'Plus Jakarta Sans', provider: 'google', weights: [400, 500, 600, 700] },
    // Šachovnice
    { name: 'Unbounded', provider: 'google', weights: [500, 700, 800] },
    { name: 'Urbanist', provider: 'google', weights: [500, 600, 700, 800] },
    // Výloha
    { name: 'Marcellus', provider: 'google', weights: [400] },
    { name: 'Cabin', provider: 'google', weights: [400, 500, 600, 700] },
  ],
} satisfies DesignFonts
