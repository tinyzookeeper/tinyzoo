import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Sál
    { name: 'Baskervville', provider: 'google', weights: ['400 600'], styles: ['normal', 'italic'] },
    { name: 'Hanken Grotesk', provider: 'google', weights: ['400 700'] },
    // Tabule
    { name: 'Syne', provider: 'google', weights: ['500 800'] },
    { name: 'Instrument Sans', provider: 'google', weights: ['400 700'] },
    { name: 'DM Mono', provider: 'google', weights: [400, 500] },
    // Deka
    { name: 'Platypi', provider: 'google', weights: ['400 800'], styles: ['normal', 'italic'] },
    { name: 'Albert Sans', provider: 'google', weights: ['400 700'] },
  ],
} satisfies DesignFonts
