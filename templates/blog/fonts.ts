import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Obálka: Spectral for the name, headings and text, Inria Sans for labels and bylines
    { name: 'Spectral', provider: 'google', weights: [200, 300, 400, 500], styles: ['normal', 'italic'] },
    { name: 'Inria Sans', provider: 'google', weights: [300, 400, 700], styles: ['normal', 'italic'] },
    // Čtvrthodinka: Schibsted Grotesk for everything, Crimson Pro italic for standfirsts
    { name: 'Schibsted Grotesk', provider: 'google', weights: ['400 900'], styles: ['normal'] },
    { name: 'Crimson Pro', provider: 'google', weights: [400, 500], styles: ['italic'] },
  ],
} satisfies DesignFonts
