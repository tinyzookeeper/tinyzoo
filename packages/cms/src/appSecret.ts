/**
 * NUXT_SESSION_PASSWORD standing in for NUXT_APP_SECRET (deprecated, removed in 0.5).
 *
 * nuxt-auth-utils 0.6 seals the sign-in cookie with a key Nuxt derives from its app secret
 * (`NUXT_APP_SECRET`) and no longer reads `NUXT_SESSION_PASSWORD`. So that a site deployed
 * with only the old variable keeps starting (and signing people in) after the update, the
 * server takes the session password as the app secret when no app secret is set at all.
 * A set app secret always wins, whatever else uses it (signed image URLs…).
 *
 * Nitro reads the environment into its runtime config once, when its config module is
 * evaluated, and freezes it; a Nitro plugin runs too late to change it. So the copy is put
 * at the top of that module in the server bundle (module.ts), before the environment is
 * read. The start-up check (server/plugins/cms-0-config-check.ts) then warns that the old
 * name is deprecated, or refuses to start when there is no secret at all.
 *
 * Build-time only; kept apart from module.ts so it can be tested on its own.
 */

/** Where the start-up check finds the name of what stood in for the app secret (the same string there). */
export const APP_SECRET_FROM = 'tinyzoo.appSecretFrom'

/** The runtime config path a 0.3 site may have set the password at in nuxt.config (the same string in the start-up check). */
export const CONFIG_SESSION_PASSWORD = 'runtimeConfig.session.password'

/** Nitro's runtime config module, the one the fallback is put at the top of. */
export const NITRO_CONFIG_MODULE = /[\\/]nitropack[\\/]dist[\\/]runtime[\\/]internal[\\/]config\.mjs$/

export interface AppSecretPlan {
  /** Put the fallback into the server bundle. */
  install: boolean
  /** `runtimeConfig.session.password` (nuxt.config) was taken as the build's app secret. */
  fromConfig: boolean
  envPrefix: string
}

/**
 * What to do for a build, from Nitro's runtime config. Mutates `runtimeConfig`: when a site
 * set `runtimeConfig.session.password` in its nuxt.config (tinyzoo 0.3 accepted it) and no
 * app secret, that value becomes the build's `appSecret`. It is in the built runtime config
 * already (as `session.password`), so nothing new is written into the bundle, and a
 * NUXT_APP_SECRET set at runtime still wins over it.
 */
export function planAppSecretFallback(runtimeConfig: Record<string, any>): AppSecretPlan {
  const envPrefix = String(runtimeConfig.nitro?.envPrefix || 'NUXT_')
  // Set in nuxt.config, or generated for `nuxt dev`: nothing to stand in for.
  if (runtimeConfig.appSecret) return { install: false, fromConfig: false, envPrefix }
  const password = runtimeConfig.session?.password
  const fromConfig = typeof password === 'string' && password.length > 0
  if (fromConfig) runtimeConfig.appSecret = password
  return { install: true, fromConfig, envPrefix }
}

/**
 * The lines put at the top of Nitro's config module. When neither `<prefix>APP_SECRET` nor
 * `NITRO_APP_SECRET` is set, `<prefix>SESSION_PASSWORD` (or `NITRO_SESSION_PASSWORD`) is
 * copied to the app secret variable Nitro reads first, and the name of what stood in is
 * left for the start-up check. Carries no secret.
 */
export function appSecretFallbackCode(envPrefix: string, fromConfig: boolean): string {
  const prefix = JSON.stringify(envPrefix)
  return `;(() => {
  const env = globalThis.process?.env
  if (!env || env[${prefix} + 'APP_SECRET'] || env.NITRO_APP_SECRET) return
  const from = [${prefix} + 'SESSION_PASSWORD', 'NITRO_SESSION_PASSWORD'].find((name) => env[name])
  const mark = (name) => { globalThis[Symbol.for(${JSON.stringify(APP_SECRET_FROM)})] = name }
  if (!from) {
    ${fromConfig ? `mark(${JSON.stringify(CONFIG_SESSION_PASSWORD)})` : ''}
    return
  }
  // Nitro reads NITRO_APP_SECRET first, even when it is empty.
  env[env.NITRO_APP_SECRET !== undefined ? 'NITRO_APP_SECRET' : ${prefix} + 'APP_SECRET'] = env[from]
  mark(from)
})();
`
}

/**
 * The source map of `code + source` when `code` is whole lines put in front: the added lines
 * map to nothing, every line of `source` to itself (line by line, which is all a stack trace
 * needs). Saves a dependency for one prepend.
 */
export function prependedLinesMap(code: string, source: string, file: string) {
  const added = code.split('\n').length - 1
  const lines = source.split('\n').length
  // Per line: generated column 0, source 0, the next source line (+1, "C"; the first is +0, "A"), column 0.
  const mappings = ';'.repeat(added) + Array.from({ length: lines }, (_, i) => (i ? 'AACA' : 'AAAA')).join(';')
  return { version: 3, file, sources: [file], sourcesContent: [source], names: [], mappings }
}
