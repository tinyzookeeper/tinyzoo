import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Časomíra: dot-matrix figures, a heavy grotesque and its mono
    { name: 'Doto', provider: 'google', weights: [700, 900] },
    { name: 'Chivo', provider: 'google', weights: [300, 400, 500, 700, 800, 900] },
    { name: 'Chivo Mono', provider: 'google', weights: [400, 500] },
    // Soutisk
    { name: 'Dela Gothic One', provider: 'google', weights: [400] },
    { name: 'Rubik', provider: 'google', weights: [400, 500, 700] },
  ],
} satisfies DesignFonts
