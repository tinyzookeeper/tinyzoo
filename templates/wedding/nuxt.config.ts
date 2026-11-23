// The Wedding template: a tinyzoo website in three looks (looks.ts). The admin lives at
// /admin, the content API at /api/content, and the pages read from it.
//
// Nothing here belongs to one site. The look, the colours, the names and the date come from
// the site's own settings at run time, so one build serves every site made from the template.
export default defineNuxtConfig({
  // (the kit first: what it sets, such as the admin's name, stands over tinyzoo's own defaults)
  extends: ['tinyzoo-template-kit/layer', 'tinyzoo/layer'],
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  build: { transpile: ['@tinyzoo/client', 'tinyzoo-template-kit'] },
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  // The typefaces of the three looks, through @nuxt/fonts: downloaded from Google at build time
  // and served by the site itself (no request to Google from a visitor's browser). The looks name
  // them through CSS variables, which @nuxt/fonts cannot see, so they are declared here. A
  // browser only fetches the files of the look a site shows.
  fonts: {
    families: [
      // Oznámení: one Caslon family
      { name: 'Libre Caslon Display', provider: 'google', weights: [400], global: true },
      { name: 'Libre Caslon Text', provider: 'google', weights: [400, 700], styles: ['normal', 'italic'], global: true },
      // Večer
      { name: 'Newsreader', provider: 'google', weights: ['300 500'], styles: ['normal', 'italic'], global: true },
      { name: 'Jost', provider: 'google', weights: [400, 500], global: true },
      // Magazín
      { name: 'Bodoni Moda', provider: 'google', weights: ['400 500'], styles: ['normal', 'italic'], global: true },
      { name: 'Hanken Grotesk', provider: 'google', weights: [400, 500], global: true },
    ],
    // Axes beyond weight, asked of Google itself (it serves the file with the axis in it).
    google: { experimental: { variableAxis: { 'Newsreader': { opsz: [['6', '72']] }, 'Bodoni Moda': { opsz: [['6', '96']] } } } },
  },
  compatibilityDate: '2025-06-01',
})
