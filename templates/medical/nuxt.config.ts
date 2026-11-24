// The Medical template: a tinyzoo website for a medical practice in two looks (looks.ts). The
// admin lives at /admin, the content API at /api/content, and the pages read from it.
//
// Nothing here belongs to one site. The look, the colours, the name and the opening hours come
// from the site's own settings and collections at run time, so one build serves every site
// made from the template.
import { ownFonts } from 'tinyzoo-template-kit/fonts'
import designFonts from './fonts'

export default defineNuxtConfig({
  // (the kit first: what it sets, such as the admin's name, stands over tinyzoo's own defaults)
  extends: ['tinyzoo-template-kit/layer', 'tinyzoo/layer'],
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  build: { transpile: ['@tinyzoo/client', 'tinyzoo-template-kit'] },
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  // The typefaces of the two looks (fonts.ts). Global here: every page of the template's own
  // build carries their @font-face rules, and a browser only fetches the files of the look a site shows.
  fonts: ownFonts(designFonts),
  compatibilityDate: '2025-06-01',
})
