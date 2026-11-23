// The Blog template: a tinyzoo website in two looks (looks.ts). The admin lives at /admin, the
// content API at /api/content, and the pages read from it.
//
// Nothing here belongs to one site. The look, the colours, the name and the publisher come from
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
      // Obálka: Spectral for the name, headings and text, Inria Sans for labels and bylines
      { name: 'Spectral', provider: 'google', weights: [200, 300, 400, 500], styles: ['normal', 'italic'], global: true },
      { name: 'Inria Sans', provider: 'google', weights: [300, 400, 700], styles: ['normal', 'italic'], global: true },
      // Čtvrthodinka: Schibsted Grotesk for everything, Crimson Pro italic for standfirsts
      { name: 'Schibsted Grotesk', provider: 'google', weights: ['400 900'], styles: ['normal'], global: true },
      { name: 'Crimson Pro', provider: 'google', weights: [400, 500], styles: ['italic'], global: true },
    ],
  },
  compatibilityDate: '2025-06-01',
})
