// Check the settings a production server cannot work without, when it starts: the platform
// then shows a start that failed with the variable's name, instead of a server that
// answers "ready" and fails the first sign-in (or the first request) with a bare 500.
//  - NUXT_APP_SECRET: at least 32 characters (nuxt-auth-utils seals the session cookie with
//    a key derived from it). NUXT_SESSION_PASSWORD (and nuxt.config's
//    runtimeConfig.session.password) stood in for it until 0.5 and are not read any more:
//    when only the old one is set, the message says to rename it;
//    the example value of the starter's .env.example (cmsAppSecret.ts) is refused too: anyone can
//    read it, so the cookie would be sealed with a public key. Development only warns about it;
//  - a database address: NUXT_CMS_DATABASE_URL or DATABASE_URL;
//  - NUXT_CMS_PUBLIC_URL: not fatal, but the links in emails need it (and the sitemap's addresses) — one warning.
// Development keeps its defaults (Nuxt generates an app secret, the dev database is in
// .env); a prerender during the build has no runtime settings either.
export default defineNitroPlugin(() => {
  if (import.meta.prerender) return
  const config = useRuntimeConfig()
  const cms = (config.cms ?? {}) as any
  // The variable Nitro read the app secret from: NITRO_APP_SECRET when it is there (even
  // empty), otherwise the site's prefix (NUXT_, or nitro.envPrefix).
  const prefix = String((config as any).nitro?.envPrefix || 'NUXT_')
  const name = process.env.NITRO_APP_SECRET !== undefined ? 'NITRO_APP_SECRET' : `${prefix}APP_SECRET`

  if (process.env.NODE_ENV !== 'production') {
    if (cmsAuthMode() === 'builtin' && (config as any).appSecret === CMS_EXAMPLE_APP_SECRET) console.warn(cmsExampleSecretWarning(name))
    return
  }

  const problems: string[] = []
  if (cmsAuthMode() === 'builtin') {
    const secret = (config as any).appSecret
    if (secret !== undefined && secret !== null && secret !== '' && typeof secret !== 'string') {
      const kind = Array.isArray(secret) ? 'a list' : typeof secret === 'object' ? 'an object' : `a ${typeof secret}`
      problems.push(`${name} was read as ${kind}, not as text (the environment is parsed as JSON where it can be). `
        + 'Make one with: openssl rand -base64 32')
    }
    else if (secret === CMS_EXAMPLE_APP_SECRET) {
      problems.push(cmsExampleSecretRefusal(name))
    }
    else if (String(secret ?? '').length < 32) {
      const unset = !secret
      let message = `${name} is ${unset ? 'not set' : 'only ' + String(secret).length + ' characters long'}; it must be at least 32 characters `
        + '(the sign-in cookie is sealed with a key derived from it). Make one with: openssl rand -base64 32'
      if (unset) {
        // The names a site used before 0.4 (and, until 0.5, as a stand-in): not read any more.
        const oldNames = [`${prefix}SESSION_PASSWORD`, 'NITRO_SESSION_PASSWORD'].filter((n) => process.env[n])
        const fromConfig = typeof (config as any).session?.password === 'string' && (config as any).session.password.length > 0
        if (oldNames.length) {
          message += `\n    ${oldNames.join(' and ')} is set, but no longer used (nuxt-auth-utils 0.6 seals the cookie with the app secret). `
            + `Rename the variable to ${prefix}APP_SECRET and keep its value: nobody is signed out.`
        }
        else if (fromConfig) {
          message += `\n    runtimeConfig.session.password is set in nuxt.config, but no longer used. Move the value to ${prefix}APP_SECRET in the environment and remove it from the config.`
        }
      }
      problems.push(message)
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
    console.warn('[cms] NUXT_CMS_PUBLIC_URL is not set: the links in invitation and password-reset emails need the site\'s public address '
      + '(e.g. https://cms.example.com), and so does /sitemap.xml (a 404 until it, or NUXT_SITE_URL, is set). Set it in the environment.')
  }
})
