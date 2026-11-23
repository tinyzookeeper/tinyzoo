import type { CmsAccent, CmsAdminLogo } from '../src/theme'

// Default CMS app config (merged into the host; host values win).
//
// `cms.fields` is the field/view registry: map a field TYPE to override its edit
// and/or cell renderer component (referenced by auto-imported component name).
// It is empty here — built-in renderers come from each field descriptor's `ui`
// hint (e.g. text → CmsFieldText / CmsCellText). A host extends or overrides by
// adding entries in its own app.config.ts and shipping same-named components:
//
//   export default defineAppConfig({
//     cms: { fields: { select: { edit: 'MySegmentedSelect' } } },
//   })
//
// `cms.admin` brands and localizes the administration (host values win):
//
//   cms: { admin: {
//     name: { cs: 'Pekárna Novák', en: 'Novák Bakery' }, // shown in the sidebar and tab title
//     nameFrom: 'siteSettings.siteName',                  // optional: the name is this field of a global, read at run time
//     siteUrl: 'https://pekarna-novak.cz',                // "View website" link
//     accent: 'mono',                                     // mono | indigo | blue | violet | emerald, or any hex ('#B4532A')
//     logo: { full: '/brand/logo.svg', mark: '/brand/mark.svg' }, // optional; fullDark / markDark too
//     signature: true,                                    // tinyzoo's quiet signature; false hides it
//     animals: true,                                      // tinyzoo's animals at the moments; false hides them all
//     locales: ['cs', 'en'], defaultLocale: 'cs',         // admin interface languages
//     timeZone: 'Europe/Prague',                          // how dates are shown
//   } }
export default defineAppConfig({
  cms: {
    fields: {} as Record<string, { edit?: string; cell?: string }>,
    admin: {
      // Unset: the admin is called tinyzoo. A client's name makes it theirs.
      name: 'tinyzoo' as string | Record<string, string>,
      // '<global>.<field>' (e.g. 'siteSettings.siteName'): the name is that field's value, read when
      // the site runs; `name` stays the fallback while the field is empty. Unset: `name` only.
      nameFrom: '' as string,
      siteUrl: '/',
      accent: 'mono' as CmsAccent,
      logo: {} as CmsAdminLogo,
      signature: true as boolean,
      // tinyzoo's animals at the moments (sign-in, welcome, empty places, success). With a brand
      // colour they are drawn in a muted shade of it. false: no animals anywhere (a white-label admin).
      animals: true as boolean,
      locales: ['cs', 'en', 'de'] as string[],
      defaultLocale: 'en',
      timeZone: 'Europe/Prague',
    },
  },
})
