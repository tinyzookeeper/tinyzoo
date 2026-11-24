export default defineAppConfig({
  cms: {
    // The admin's name (top left) and languages. Change to the client's name.
    admin: {
      name: { en: 'My website', cs: 'Můj web' },
      // The name editors give the site in Site settings is the admin's name too; `name` shows until there is one.
      nameFrom: 'siteSettings.siteName',
      siteUrl: '/',
      defaultLocale: 'cs',
    },
  },
})
