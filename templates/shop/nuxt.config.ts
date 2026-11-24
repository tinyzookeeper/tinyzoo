// The Shop template: a tinyzoo website in three looks (looks.ts). The admin lives at /admin,
// the content API at /api/content, and the pages read from it.
//
// Nothing here belongs to one site. The look, the colours, the name, the address and the
// opening hours come from the site's own settings at run time, so one build serves every site
// made from the template.
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
      // Portál
      { name: 'Vollkorn', provider: 'google', weights: ['400 900'], styles: ['normal', 'italic'], global: true },
      { name: 'Commissioner', provider: 'google', weights: ['400 700'], global: true },
      // Regál
      { name: 'Schibsted Grotesk', provider: 'google', weights: ['400 900'], global: true },
      { name: 'Saira Extra Condensed', provider: 'google', weights: [500, 600, 700, 800], global: true },
      // Na háčku
      { name: 'Gabarito', provider: 'google', weights: ['400 900'], global: true },
      { name: 'Nunito Sans', provider: 'google', weights: ['400 800'], global: true },
    ],
    // Axes beyond weight, asked of Google itself (it serves the file with the axis in it).
    google: { experimental: { variableAxis: { 'Nunito Sans': { opsz: [['6', '12']] } } } },
  },
  compatibilityDate: '2025-06-01',
})
