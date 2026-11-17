export default defineAppConfig({
  ui: {
    colors: {
      // Primary brand = a neutral gray anchored at #555 (the `ink` ramp in main.css).
      primary: 'ink',
      // Accent / surfaces = a true neutral gray (no blue/zinc tint).
      neutral: 'neutral',
    },
  },
  cms: {
    // The admin's branding and interface languages (see the layer's app.config.ts).
    admin: {
      name: { en: 'Demo Blog', cs: 'Demo blog', de: 'Demo-Blog' },
      siteUrl: '/blog',
      defaultLocale: 'cs',
    },
    fields: {
      // Demo of the field registry: render `select` fields (the post status) as a
      // segmented control via a host component instead of the built-in dropdown.
      select: { edit: 'PgStatusSelect' },
    },
  },
})
