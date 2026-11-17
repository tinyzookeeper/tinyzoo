import { cmsDeprecated } from 'tinyzoo'

// Check the settings a production server cannot work without, when it starts: the platform
// then shows a start that failed with the variable's name, instead of a server that
// answers "ready" and fails the first sign-in (or the first request) with a bare 500.
//  - NUXT_APP_SECRET: at least 32 characters (nuxt-auth-utils seals the session cookie with
//    a key derived from it). Until 0.5, NUXT_SESSION_PASSWORD stands in for it when it is not
//    set (module.ts, appSecretFallback), with a deprecation warning;
//  - a database address: NUXT_CMS_DATABASE_URL or DATABASE_URL;
//  - NUXT_CMS_PUBLIC_URL: not fatal, but the sitemap and the links in emails need it — one warning.
// Development keeps its defaults (Nuxt generates an app secret, the dev database is in
// .env); a prerender during the build has no runtime settings either.
export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production' || import.meta.prerender) return
  const config = useRuntimeConfig()
  const cms = (config.cms ?? {}) as any

  const problems: string[] = []
  if (cmsAuthMode() === 'builtin') {
    const secret = (config as any).appSecret
    const from = (globalThis as any)[Symbol.for('tinyzoo.appSecretFrom')] as string | undefined
    const name = from ? `${from} (used because NUXT_APP_SECRET is not set)` : 'NUXT_APP_SECRET'
    if (secret !== undefined && secret !== null && secret !== '' && typeof secret !== 'string') {
      const kind = Array.isArray(secret) ? 'a list' : typeof secret === 'object' ? 'an object' : `a ${typeof secret}`
      problems.push(`${name} was read as ${kind}, not as text (the environment is parsed as JSON where it can be). `
        + 'Make one with: openssl rand -base64 32')
    }
    else if (String(secret ?? '').length < 32) {
      problems.push(`${name} is ${secret ? 'only ' + String(secret).length + ' characters long' : 'not set'}; it must be at least 32 characters `
        + '(the sign-in cookie is sealed with a key derived from it). Make one with: openssl rand -base64 32')
    }
    else if (from) {
      cmsDeprecated('env:NUXT_SESSION_PASSWORD', `${from} is used as the app secret because NUXT_APP_SECRET is not set: nuxt-auth-utils 0.6 `
        + 'no longer reads it. Rename the variable to NUXT_APP_SECRET; with the same value nobody is signed out again.', { removeIn: '0.5.0' })
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
