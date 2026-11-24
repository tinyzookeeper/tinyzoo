import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Výkres: one family in three widths
    { name: 'Encode Sans Expanded', provider: 'google', weights: [300, 400, 500] },
    { name: 'Encode Sans', provider: 'google', weights: [300, 400, 500, 600] },
    { name: 'Encode Sans Condensed', provider: 'google', weights: [400, 500, 600] },
    // Harmonogram
    { name: 'Schibsted Grotesk', provider: 'google', weights: [400, 500, 600, 700, 800, 900] },
    { name: 'Red Hat Mono', provider: 'google', weights: [400, 500, 600] },
    // Zdivo
    { name: 'Rokkitt', provider: 'google', weights: [500, 700, 800], styles: ['normal', 'italic'] },
    { name: 'Familjen Grotesk', provider: 'google', weights: [400, 500, 600, 700] },
  ],
} satisfies DesignFonts
