import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Oznámení: one Caslon family
    { name: 'Libre Caslon Display', provider: 'google', weights: [400] },
    { name: 'Libre Caslon Text', provider: 'google', weights: [400, 700], styles: ['normal', 'italic'] },
    // Večer
    { name: 'Newsreader', provider: 'google', weights: ['300 500'], styles: ['normal', 'italic'] },
    { name: 'Jost', provider: 'google', weights: [400, 500] },
    // Magazín
    { name: 'Bodoni Moda', provider: 'google', weights: ['400 500'], styles: ['normal', 'italic'] },
    { name: 'Hanken Grotesk', provider: 'google', weights: [400, 500] },
  ],
  // Axes beyond weight, asked of Google itself (it serves the file with the axis in it).
  variableAxis: { 'Newsreader': { opsz: [['6', '72']] }, 'Bodoni Moda': { opsz: [['6', '96']] } },
} satisfies DesignFonts
