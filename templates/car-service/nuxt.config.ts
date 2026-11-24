// The Garage template: a tinyzoo website in three looks (looks.ts). The admin lives at
// /admin, the content API at /api/content, and the pages read from it.
//
// Nothing here belongs to one site. The look, the colours, the name, the prices and the hours
// come from the site's own settings at run time, so one build serves every site made from the template.
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
      // Cesta
      { name: 'Red Hat Display', provider: 'google', weights: [500, 600, 700, 800], global: true },
      { name: 'Red Hat Text', provider: 'google', weights: [400, 500, 600], global: true },
      // Kontrolky
      { name: 'Oxanium', provider: 'google', weights: [400, 500, 600, 700], global: true },
      { name: 'Sora', provider: 'google', weights: [300, 400, 500, 600], global: true },
      // Šuplíky (the headings are italic; the figures upright)
      { name: 'Kanit', provider: 'google', weights: [600, 700, 800], styles: ['normal', 'italic'], global: true },
      { name: 'Rubik', provider: 'google', weights: [400, 500, 600], global: true },
    ],
  },
  compatibilityDate: '2025-06-01',
})
