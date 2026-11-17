import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { appSecretFallbackCode, planAppSecretFallback, prependedLinesMap } from '../../packages/cms/src/appSecret'

// NUXT_SESSION_PASSWORD standing in for NUXT_APP_SECRET until 0.5 (packages/cms/src/appSecret.ts):
// what the build decides, and what the lines put in front of Nitro's config module do.
const run = (env: Record<string, string>, opts: { prefix?: string; fromConfig?: boolean } = {}) => {
  const context: any = { process: { env: { ...env } } }
  runInNewContext(appSecretFallbackCode(opts.prefix ?? 'NUXT_', opts.fromConfig ?? false), context)
  // Read inside the context: a symbol-keyed global is not mirrored onto the sandbox object.
  const from = runInNewContext(`globalThis[Symbol.for('tinyzoo.appSecretFrom')]`, context) as string | undefined
  return { env: context.process.env, from }
}

describe('the build: is the stand-in put in?', () => {
  it('not when nuxt.config sets runtimeConfig.appSecret (or `nuxt dev` generated one)', () => {
    expect(planAppSecretFallback({ appSecret: 'set-in-nuxt-config-0123456789abcdef' })).toMatchObject({ install: false })
  })

  it('yes otherwise, with the site\'s env prefix', () => {
    expect(planAppSecretFallback({ appSecret: '' })).toEqual({ install: true, fromConfig: false, envPrefix: 'NUXT_' })
    expect(planAppSecretFallback({ nitro: { envPrefix: 'MYSITE_' } })).toEqual({ install: true, fromConfig: false, envPrefix: 'MYSITE_' })
  })

  it('a runtimeConfig.session.password from nuxt.config (tinyzoo 0.3) becomes the build\'s app secret', () => {
    const config: any = { appSecret: '', session: { password: 'a-password-set-in-nuxt-config-0123456789', maxAge: 1 } }
    expect(planAppSecretFallback(config)).toEqual({ install: true, fromConfig: true, envPrefix: 'NUXT_' })
    expect(config.appSecret).toBe('a-password-set-in-nuxt-config-0123456789')
  })
})

describe('at start: the lines in front of Nitro\'s config module', () => {
  const OLD = 'the-old-session-password-of-this-site-0123456789'

  it('copy NUXT_SESSION_PASSWORD to NUXT_APP_SECRET when no app secret is set, and say so', () => {
    expect(run({ NUXT_SESSION_PASSWORD: OLD })).toEqual({ env: { NUXT_SESSION_PASSWORD: OLD, NUXT_APP_SECRET: OLD }, from: 'NUXT_SESSION_PASSWORD' })
    expect(run({ NITRO_SESSION_PASSWORD: OLD }).env.NUXT_APP_SECRET).toBe(OLD)
  })

  it('leave a set NUXT_APP_SECRET or NITRO_APP_SECRET alone', () => {
    expect(run({ NUXT_APP_SECRET: 'kept', NUXT_SESSION_PASSWORD: OLD })).toEqual({ env: { NUXT_APP_SECRET: 'kept', NUXT_SESSION_PASSWORD: OLD }, from: undefined })
    expect(run({ NITRO_APP_SECRET: 'kept', NUXT_SESSION_PASSWORD: OLD })).toEqual({ env: { NITRO_APP_SECRET: 'kept', NUXT_SESSION_PASSWORD: OLD }, from: undefined })
  })

  it('write to an empty NITRO_APP_SECRET, which Nitro reads first', () => {
    expect(run({ NITRO_APP_SECRET: '', NUXT_SESSION_PASSWORD: OLD }).env).toEqual({ NITRO_APP_SECRET: OLD, NUXT_SESSION_PASSWORD: OLD })
  })

  it('follow a custom env prefix', () => {
    expect(run({ MYSITE_SESSION_PASSWORD: OLD }, { prefix: 'MYSITE_' }).env.MYSITE_APP_SECRET).toBe(OLD)
    expect(run({ NUXT_SESSION_PASSWORD: OLD }, { prefix: 'MYSITE_' }).env.MYSITE_APP_SECRET).toBeUndefined()
  })

  it('with nothing in the environment: the nuxt.config password (already the build\'s app secret) is named, nothing written', () => {
    expect(run({}, { fromConfig: true })).toEqual({ env: {}, from: 'runtimeConfig.session.password' })
    expect(run({})).toEqual({ env: {}, from: undefined })
    // An environment variable still wins over it, as it did in 0.3.
    expect(run({ NUXT_SESSION_PASSWORD: OLD }, { fromConfig: true }).from).toBe('NUXT_SESSION_PASSWORD')
  })

  it('carry no secret of the build', () => {
    expect(appSecretFallbackCode('NUXT_', true)).not.toMatch(/password-set-in|[0-9a-f]{32}/)
  })
})

describe('the source map of the prepended lines', () => {
  it('maps every line of the module to itself, after the added ones', () => {
    const code = 'a\nb\n'
    const map = prependedLinesMap(code, 'x\ny\nz', 'config.mjs')
    expect(map.mappings).toBe(';;AAAA;AACA;AACA')
    expect(map.sources).toEqual(['config.mjs'])
  })
})
