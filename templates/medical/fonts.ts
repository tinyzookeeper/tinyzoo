import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Čekárna
    { name: 'Wix Madefor Display', provider: 'google', weights: ['500 700'] },
    { name: 'Wix Madefor Text', provider: 'google', weights: ['400 700'] },
    // Ciferník
    { name: 'Fredoka', provider: 'google', weights: ['400 600'] },
    { name: 'Mulish', provider: 'google', weights: ['400 800'] },
  ],
} satisfies DesignFonts
