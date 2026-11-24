// The Office template: a tinyzoo website in two looks (looks.ts). The admin lives at /admin,
// the content API at /api/content, and the pages read from it.
//
// Nothing here belongs to one site. The look, the colours, the name and the contact details come
// from the site's own settings at run time, so one build serves every site made from the template.
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
      // Lhůty: one Plex family, three cuts
      { name: 'IBM Plex Serif', provider: 'google', weights: [400, 500], styles: ['normal', 'italic'], global: true },
      { name: 'IBM Plex Sans', provider: 'google', weights: [400, 500, 600], global: true },
      { name: 'IBM Plex Mono', provider: 'google', weights: [400, 500], global: true },
      // Šanony: heavy display type (condensed to 78 % on the spines) and a plain text face
      { name: 'Bricolage Grotesque', provider: 'google', weights: ['400 800'], global: true },
      { name: 'Public Sans', provider: 'google', weights: [400, 500, 600, 700], global: true },
    ],
    // Axes beyond weight, asked of Google itself (it serves the file with the axis in it).
    google: { experimental: { variableAxis: { 'Bricolage Grotesque': { opsz: [['12', '96']], wdth: [['75', '100']] } } } },
  },
  compatibilityDate: '2025-06-01',
})
