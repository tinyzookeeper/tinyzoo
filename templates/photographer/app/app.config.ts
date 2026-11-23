export default defineAppConfig({
  cms: {
    // The admin's name (top left) and languages.
    admin: {
      name: { en: 'My website', cs: 'Můj web' },
      siteUrl: '/',
      defaultLocale: 'cs',
    },
  },
})
