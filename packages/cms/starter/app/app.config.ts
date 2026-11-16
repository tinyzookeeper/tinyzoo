export default defineAppConfig({
  cms: {
    // The admin's name (top left) and languages. Change to the client's name.
    admin: {
      name: { en: 'My website', cs: 'Můj web' },
      siteUrl: '/',
      defaultLocale: 'cs',
    },
  },
})
