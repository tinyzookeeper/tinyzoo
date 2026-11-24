import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Ateliér
    { name: 'Newsreader', provider: 'google', weights: ['300 500'], styles: ['normal', 'italic'] },
    { name: 'Jost', provider: 'google', weights: [400, 500] },
    // Negativ (Archivo's width axis: 62 % for the display type)
    { name: 'Archivo', provider: 'google', weights: ['400 900'] },
    { name: 'JetBrains Mono', provider: 'google', weights: [400, 500] },
    // Zápisník
    { name: 'Young Serif', provider: 'google', weights: [400] },
    { name: 'Karla', provider: 'google', weights: [400, 500, 700] },
    { name: 'Caveat', provider: 'google', weights: [500, 600] },
  ],
  // Axes beyond weight, asked of Google itself (it serves the file with the axis in it).
  variableAxis: { Archivo: { wdth: [['62', '125']] }, Newsreader: { opsz: [['6', '72']] } },
} satisfies DesignFonts
