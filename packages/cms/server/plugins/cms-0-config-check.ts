// Check the settings a production server cannot work without, when it starts: the platform
// then shows a start that failed with the variable's name, instead of a server that
// answers "ready" and fails the first sign-in (or the first request) with a bare 500.
//  - NUXT_SESSION_PASSWORD: at least 32 characters (it seals the session cookie);
//  - a database address: NUXT_CMS_DATABASE_URL or DATABASE_URL;
//  - NUXT_CMS_PUBLIC_URL: not fatal, but the sitemap and the links in emails need it — one warning.
// Development keeps its defaults (nuxt-auth-utils makes a password, the dev database is
// in .env); a prerender during the build has no runtime settings either.
export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production' || import.meta.prerender) return
  const config = useRuntimeConfig()
  const cms = (config.cms ?? {}) as any

  const problems: string[] = []
  if (cmsAuthMode() === 'builtin') {
    const password = String(process.env.NUXT_SESSION_PASSWORD || (config.session as any)?.password || '')
    if (password.length < 32) {
      problems.push(`NUXT_SESSION_PASSWORD is ${password ? 'only ' + password.length + ' characters long' : 'not set'}; it must be at least 32 characters `
        + '(it seals the session cookie). Make one with: openssl rand -base64 32')
    }
  }
  if (!(process.env.NUXT_CMS_DATABASE_URL || process.env.DATABASE_URL || cms.databaseUrl)) {
    problems.push('No database address: set DATABASE_URL (or NUXT_CMS_DATABASE_URL) to a Postgres connection string, e.g. postgres://user:password@host:5432/dbname')
  }
  if (problems.length) {
    const message = '[tinyzoo] the server cannot start:\n  - ' + problems.join('\n  - ')
    console.error(message)
    throw new Error(message)
  }

  if (!String(cms.publicUrl || '').trim()) {
    console.warn('[cms] NUXT_CMS_PUBLIC_URL is not set: /sitemap.xml and the links in invitation and password-reset emails need the site\'s public address '
      + '(e.g. https://cms.example.com). Set it in the environment.')
  }
})
