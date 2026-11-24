import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Lhůty: one Plex family, three cuts
    { name: 'IBM Plex Serif', provider: 'google', weights: [400, 500], styles: ['normal', 'italic'] },
    { name: 'IBM Plex Sans', provider: 'google', weights: [400, 500, 600] },
    { name: 'IBM Plex Mono', provider: 'google', weights: [400, 500] },
    // Šanony: heavy display type (condensed to 78 % on the spines) and a plain text face
    { name: 'Bricolage Grotesque', provider: 'google', weights: ['400 800'] },
    { name: 'Public Sans', provider: 'google', weights: [400, 500, 600, 700] },
  ],
  // Axes beyond weight, asked of Google itself (it serves the file with the axis in it).
  variableAxis: { 'Bricolage Grotesque': { opsz: [['12', '96']], wdth: [['75', '100']] } },
} satisfies DesignFonts
