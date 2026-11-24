import type { DesignFonts } from 'tinyzoo-template-kit/fonts'

// The typefaces of the looks (looks.ts), through @nuxt/fonts: downloaded from Google at build time
// and served by the site itself (no request to Google from a visitor's browser). The template's own
// build declares them global (nuxt.config.ts); the one app (templates/app) merges every design's list.
export default {
  families: [
    // Salon
    { name: 'Brygada 1918', provider: 'google', weights: ['400 700'], styles: ['normal', 'italic'] },
    { name: 'Josefin Sans', provider: 'google', weights: [400, 600] },
    // Talíř
    { name: 'Anybody', provider: 'google', weights: ['100 900'] },
    { name: 'Hanken Grotesk', provider: 'google', weights: [400, 500, 700] },
    // Paragon
    { name: 'Besley', provider: 'google', weights: ['400 900'], styles: ['normal', 'italic'] },
    { name: 'Courier Prime', provider: 'google', weights: [400, 700], styles: ['normal', 'italic'] },
  ],
  // Axes beyond weight, asked of Google itself (it serves the file with the axis in it):
  // Anybody's width is what makes its headlines wide and its labels narrow.
  variableAxis: { Anybody: { wdth: [['50', '150']] } },
} satisfies DesignFonts
