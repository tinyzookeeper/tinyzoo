// The Accommodation template: a tinyzoo website in two looks (looks.ts). The admin lives at
// /admin, the content API at /api/content, and the pages read from it.
//
// Nothing here belongs to one site. The look, the colours, the name, the address and the prices come from
// the site's own settings at run time, so one build serves every site made from the template.
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
      // Celý rok: Gloock for the headings, Figtree for everything else
      { name: 'Gloock', provider: 'google', weights: [400], global: true },
      { name: 'Figtree', provider: 'google', weights: ['400 700'], global: true },
      // Ode dveří: Rethink Sans alone
      { name: 'Rethink Sans', provider: 'google', weights: ['400 700'], global: true },
    ],
  },
  compatibilityDate: '2025-06-01',
})
