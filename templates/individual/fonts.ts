import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Vizitka
    { name: 'Literata', provider: 'google', weights: ['400 600'], styles: ['normal', 'italic'] },
    { name: 'Albert Sans', provider: 'google', weights: ['400 600'] },
    // Zvýrazňovač
    { name: 'Epilogue', provider: 'google', weights: ['400 900'] },
    { name: 'Spline Sans Mono', provider: 'google', weights: ['400 500'] },
    // Rozhovor
    { name: 'Besley', provider: 'google', weights: ['400 800'], styles: ['normal', 'italic'] },
    { name: 'Alegreya Sans', provider: 'google', weights: [400, 500, 700], styles: ['normal', 'italic'] },
  ],
  // Axes beyond weight, asked of Google itself (it serves the file with the axis in it).
  variableAxis: { Literata: { opsz: [['7', '72']] } },
} satisfies DesignFonts
