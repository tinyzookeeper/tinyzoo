import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Portál
    { name: 'Vollkorn', provider: 'google', weights: ['400 900'], styles: ['normal', 'italic'] },
    { name: 'Commissioner', provider: 'google', weights: ['400 700'] },
    // Regál
    { name: 'Schibsted Grotesk', provider: 'google', weights: ['400 900'] },
    { name: 'Saira Extra Condensed', provider: 'google', weights: [500, 600, 700, 800] },
    // Na háčku
    { name: 'Gabarito', provider: 'google', weights: ['400 900'] },
    { name: 'Nunito Sans', provider: 'google', weights: ['400 800'] },
  ],
  // Axes beyond weight, asked of Google itself (it serves the file with the axis in it).
  variableAxis: { 'Nunito Sans': { opsz: [['6', '12']] } },
} satisfies DesignFonts
