// The Studio template: a tinyzoo website in three looks (looks.ts). The admin lives at
// /admin, the content API at /api/content, and the pages read from it.
//
// Nothing here belongs to one site. The look, the colours, the name and the timetable come
// from the site's own settings and collections at run time, so one build serves every site
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
      // Sál
      { name: 'Baskervville', provider: 'google', weights: ['400 600'], styles: ['normal', 'italic'], global: true },
      { name: 'Hanken Grotesk', provider: 'google', weights: ['400 700'], global: true },
      // Tabule
      { name: 'Syne', provider: 'google', weights: ['500 800'], global: true },
      { name: 'Instrument Sans', provider: 'google', weights: ['400 700'], global: true },
      { name: 'DM Mono', provider: 'google', weights: [400, 500], global: true },
      // Deka
      { name: 'Platypi', provider: 'google', weights: ['400 800'], styles: ['normal', 'italic'], global: true },
      { name: 'Albert Sans', provider: 'google', weights: ['400 700'], global: true },
    ],
  },
  compatibilityDate: '2025-06-01',
})
