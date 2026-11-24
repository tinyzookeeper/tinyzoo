import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Čtvero dob: Vollkorn for the headings and the figures (italic for the second voice), Asap for the text
    { name: 'Vollkorn', provider: 'google', weights: ['400 900'], styles: ['normal', 'italic'] },
    { name: 'Asap', provider: 'google', weights: ['400 700'], styles: ['normal', 'italic'] },
  ],
} satisfies DesignFonts
