// The Development template: a tinyzoo website in three looks (looks.ts). The admin lives at
// /admin, the content API at /api/content, and the pages read from it.
//
// Nothing here belongs to one site. The look, the colours, the project's name and its flats come
// from the site's own settings and content at run time, so one build serves every site made from
// the template.
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
      // Modrotisk: a thin display face, a plain text face and its condensed one for labels
      { name: 'Outfit', provider: 'google', weights: ['200 500'], global: true },
      { name: 'IBM Plex Sans', provider: 'google', weights: [400, 500, 600], global: true },
      { name: 'IBM Plex Sans Condensed', provider: 'google', weights: [400, 500, 600], global: true },
      // Patra
      { name: 'Instrument Serif', provider: 'google', weights: [400], styles: ['normal', 'italic'], global: true },
      { name: 'Geologica', provider: 'google', weights: ['300 600'], global: true },
      // Po slunci
      { name: 'DM Serif Display', provider: 'google', weights: [400], styles: ['normal', 'italic'], global: true },
      { name: 'Red Hat Text', provider: 'google', weights: ['400 700'], global: true },
    ],
  },
  compatibilityDate: '2025-06-01',
})
