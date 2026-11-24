import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Celý rok: Gloock for the headings, Figtree for everything else
    { name: 'Gloock', provider: 'google', weights: [400] },
    { name: 'Figtree', provider: 'google', weights: ['400 700'] },
    // Ode dveří: Rethink Sans alone
    { name: 'Rethink Sans', provider: 'google', weights: ['400 700'] },
  ],
} satisfies DesignFonts
