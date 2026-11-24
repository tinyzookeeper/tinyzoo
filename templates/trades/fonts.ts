import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Mistr
    { name: 'Libre Franklin', provider: 'google', weights: [400, 500, 600, 700, 800] },
    { name: 'Source Serif 4', provider: 'google', weights: [400, 500] },
    // Reflex
    { name: 'Sofia Sans', provider: 'google', weights: [400, 500, 700, 800, 900] },
    { name: 'Sofia Sans Condensed', provider: 'google', weights: [600, 700, 800, 900] },
  ],
  // Axes beyond weight, asked of Google itself (it serves the file with the axis in it).
  variableAxis: { 'Source Serif 4': { opsz: [['8', '60']] } },
} satisfies DesignFonts
