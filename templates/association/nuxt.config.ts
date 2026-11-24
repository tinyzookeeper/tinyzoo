// The Association template: a tinyzoo website in the look Čtvero dob (looks.ts). The admin lives
// at /admin, the content API at /api/content, and the pages read from it.
//
// Nothing here belongs to one site. The look, the colours, the name and the facts come from
// the site's own settings at run time, so one build serves every site made from the template.
export default defineNuxtConfig({
  // (the kit first: what it sets, such as the admin's name, stands over tinyzoo's own defaults)
  extends: ['tinyzoo-template-kit/layer', 'tinyzoo/layer'],
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  build: { transpile: ['@tinyzoo/client', 'tinyzoo-template-kit'] },
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  // The typefaces of the look, through @nuxt/fonts: downloaded from Google at build time and
  // served by the site itself (no request to Google from a visitor's browser). The look names
  // them through CSS variables, which @nuxt/fonts cannot see, so they are declared here.
  fonts: {
    families: [
      // Čtvero dob: Vollkorn for the headings and the figures (italic for the second voice), Asap for the text
      { name: 'Vollkorn', provider: 'google', weights: ['400 900'], styles: ['normal', 'italic'], global: true },
      { name: 'Asap', provider: 'google', weights: ['400 700'], styles: ['normal', 'italic'], global: true },
    ],
  },
  compatibilityDate: '2025-06-01',
})
