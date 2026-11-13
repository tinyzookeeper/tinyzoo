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
//     siteUrl: 'https://pekarna-novak.cz',                // "View website" link
//     accent: 'mono',                                     // mono | indigo | blue | violet | emerald
//     locales: ['cs', 'en'], defaultLocale: 'cs',         // admin interface languages
//     timeZone: 'Europe/Prague',                          // how dates are shown
//   } }
export default defineAppConfig({
  cms: {
    fields: {} as Record<string, { edit?: string; cell?: string }>,
    admin: {
      name: 'Content' as string | Record<string, string>,
      siteUrl: '/',
      accent: 'mono' as 'mono' | 'indigo' | 'blue' | 'violet' | 'emerald',
      locales: ['cs', 'en'] as string[],
      defaultLocale: 'en',
      timeZone: 'Europe/Prague',
    },
  },
})
