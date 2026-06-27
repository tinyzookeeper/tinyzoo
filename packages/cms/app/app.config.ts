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
export default defineAppConfig({
  cms: {
    fields: {} as Record<string, { edit?: string; cell?: string }>,
  },
})
