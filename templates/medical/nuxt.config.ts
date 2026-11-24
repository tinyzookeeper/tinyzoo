// The Medical template: a tinyzoo website for a medical practice in two looks (looks.ts). The
// admin lives at /admin, the content API at /api/content, and the pages read from it.
//
// Nothing here belongs to one site. The look, the colours, the name and the opening hours come
// from the site's own settings and collections at run time, so one build serves every site
// made from the template.
export default defineNuxtConfig({
  // (the kit first: what it sets, such as the admin's name, stands over tinyzoo's own defaults)
  extends: ['tinyzoo-template-kit/layer', 'tinyzoo/layer'],
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  build: { transpile: ['@tinyzoo/client', 'tinyzoo-template-kit'] },
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  // The typefaces of the two looks, through @nuxt/fonts: downloaded from Google at build time
  // and served by the site itself (no request to Google from a visitor's browser). The looks name
  // them through CSS variables, which @nuxt/fonts cannot see, so they are declared here. A
  // browser only fetches the files of the look a site shows.
  fonts: {
    families: [
      // Čekárna
      { name: 'Wix Madefor Display', provider: 'google', weights: ['500 700'], global: true },
      { name: 'Wix Madefor Text', provider: 'google', weights: ['400 700'], global: true },
      // Ciferník
      { name: 'Fredoka', provider: 'google', weights: ['400 600'], global: true },
      { name: 'Mulish', provider: 'google', weights: ['400 800'], global: true },
    ],
  },
  compatibilityDate: '2025-06-01',
})
