import { cmsDeprecated } from 'tinyzoo'

// Check the settings a production server cannot work without, when it starts: the platform
// then shows a start that failed with the variable's name, instead of a server that
// answers "ready" and fails the first sign-in (or the first request) with a bare 500.
//  - NUXT_APP_SECRET: at least 32 characters (nuxt-auth-utils seals the session cookie with
//    a key derived from it). Until 0.5, NUXT_SESSION_PASSWORD (or nuxt.config's
//    runtimeConfig.session.password) stands in for it when it is not set (src/appSecret.ts),
//    with a deprecation warning;
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
    // The variable Nitro read the app secret from: NITRO_APP_SECRET when it is there (even
    // empty), otherwise the site's prefix (NUXT_, or nitro.envPrefix).
    const prefix = String((config as any).nitro?.envPrefix || 'NUXT_')
    const secretVar = process.env.NITRO_APP_SECRET !== undefined ? 'NITRO_APP_SECRET' : `${prefix}APP_SECRET`
    // What stood in for it (src/appSecret.ts): NUXT_SESSION_PASSWORD, or nuxt.config's runtimeConfig.session.password.
    const from = (globalThis as any)[Symbol.for('tinyzoo.appSecretFrom')] as string | undefined
    const name = from ? `${from} (used because ${secretVar} is not set)` : secretVar
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
      const move = from === 'runtimeConfig.session.password'
        ? `Move the value to ${prefix}APP_SECRET in the environment and remove it from nuxt.config`
        : `Rename the variable to ${prefix}APP_SECRET`
      cmsDeprecated('env:NUXT_SESSION_PASSWORD', `${from} is used as the app secret because ${secretVar} is not set: nuxt-auth-utils 0.6 `
        + `no longer reads it. ${move}; with the same value nobody is signed out again. Until then, nuxt-auth-utils' own warning `
        + 'that it "is not used anymore" can be ignored: tinyzoo uses it.', { removeIn: '0.5.0' })
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
