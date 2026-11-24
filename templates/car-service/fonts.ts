import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Cesta
    { name: 'Red Hat Display', provider: 'google', weights: [500, 600, 700, 800] },
    { name: 'Red Hat Text', provider: 'google', weights: [400, 500, 600] },
    // Kontrolky
    { name: 'Oxanium', provider: 'google', weights: [400, 500, 600, 700] },
    { name: 'Sora', provider: 'google', weights: [300, 400, 500, 600] },
    // Šuplíky (the headings are italic; the figures upright)
    { name: 'Kanit', provider: 'google', weights: [600, 700, 800], styles: ['normal', 'italic'] },
    { name: 'Rubik', provider: 'google', weights: [400, 500, 600] },
  ],
} satisfies DesignFonts
