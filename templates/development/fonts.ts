import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Modrotisk: a thin display face, a plain text face and its condensed one for labels
    { name: 'Outfit', provider: 'google', weights: ['200 500'] },
    { name: 'IBM Plex Sans', provider: 'google', weights: [400, 500, 600] },
    { name: 'IBM Plex Sans Condensed', provider: 'google', weights: [400, 500, 600] },
    // Patra
    { name: 'Instrument Serif', provider: 'google', weights: [400], styles: ['normal', 'italic'] },
    { name: 'Geologica', provider: 'google', weights: ['300 600'] },
    // Po slunci
    { name: 'DM Serif Display', provider: 'google', weights: [400], styles: ['normal', 'italic'] },
    { name: 'Red Hat Text', provider: 'google', weights: ['400 700'] },
  ],
} satisfies DesignFonts
