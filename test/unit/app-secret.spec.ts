import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CMS_EXAMPLE_APP_SECRET, cmsExampleSecretRefusal, cmsExampleSecretWarning } from '../../packages/cms/server/utils/cmsAppSecret'

// The example secret of the starter's `.env.example` is public, so a production server refuses it and a
// development server warns. The plugin (server/plugins/cms-0-config-check.ts) is run here with the
// auto-imports Nitro gives it stubbed; test/api/start-checks.spec.ts starts a real production server.

const root = join(import.meta.dirname, '../..')
const envValue = (file: string) => /^NUXT_APP_SECRET=(.*)$/m.exec(readFileSync(join(root, file), 'utf8'))?.[1]

describe('the example app secret', () => {
  it('is exactly what the starter\'s .env.example holds (so copying that file is caught)', () => {
    expect(envValue('packages/cms/starter/.env.example')).toBe(CMS_EXAMPLE_APP_SECRET)
    // long enough to pass the length check: only this rule can refuse it
    expect(CMS_EXAMPLE_APP_SECRET.length).toBeGreaterThanOrEqual(32)
  })

  it('is in no other .env.example: the playground and the website leave the secret empty', () => {
    expect(envValue('playground/.env.example')).toBe('')
    expect(envValue('site/.env.example')).toBe('')
  })

  it('is not the secret of any test server or script that runs in production mode', () => {
    for (const file of ['test/setup/server.ts', 'test/setup/timers.ts', 'test/helpers/server.ts', 'scripts/starter-check.mjs', 'scripts/upgrade-check.mjs', 'scripts/consumer-check.mjs']) {
      expect(readFileSync(join(root, file), 'utf8'), file).not.toContain(CMS_EXAMPLE_APP_SECRET)
    }
  })

  it('has messages that name the variable and say how to make a secret', () => {
    for (const text of [cmsExampleSecretRefusal('NUXT_APP_SECRET'), cmsExampleSecretWarning('NUXT_APP_SECRET')]) {
      expect(text).toContain('NUXT_APP_SECRET')
      expect(text).toContain('openssl rand -base64 32')
      expect(text).not.toContain(CMS_EXAMPLE_APP_SECRET)
    }
    expect(cmsExampleSecretRefusal('NITRO_APP_SECRET')).toContain('NITRO_APP_SECRET')
  })
})

describe('the start check', () => {
  let warn: ReturnType<typeof vi.spyOn>
  let errorLog: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('NITRO_APP_SECRET', undefined as unknown as string)
    vi.stubEnv('DATABASE_URL', 'postgres://x:x@localhost:5432/x')
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules() })

  /** Runs the plugin with this runtime config, as Nitro would when the server starts. */
  async function start(appSecret: string, { env = 'production', mode = 'builtin' }: { env?: string, mode?: string } = {}) {
    vi.stubEnv('NODE_ENV', env)
    vi.stubGlobal('defineNitroPlugin', (fn: () => void) => fn)
    vi.stubGlobal('useRuntimeConfig', () => ({ appSecret, cms: { auth: { mode }, publicUrl: 'https://example.test' } }))
    vi.stubGlobal('cmsAuthMode', () => mode)
    vi.stubGlobal('CMS_EXAMPLE_APP_SECRET', CMS_EXAMPLE_APP_SECRET)
    vi.stubGlobal('cmsExampleSecretRefusal', cmsExampleSecretRefusal)
    vi.stubGlobal('cmsExampleSecretWarning', cmsExampleSecretWarning)
    // (a path in a variable: the plugin is Nitro code, and tsc must not read it as part of the tests)
    const file = '../../packages/cms/server/plugins/cms-0-config-check'
    const plugin = (await import(/* @vite-ignore */ file)).default as () => void
    plugin()
  }

  it('refuses the example value in production, naming the variable and how to make one', async () => {
    await expect(start(CMS_EXAMPLE_APP_SECRET)).rejects.toThrow(/NUXT_APP_SECRET is the example value[\s\S]*openssl rand -base64 32/)
    expect(errorLog).toHaveBeenCalled()
  })

  it('names NITRO_APP_SECRET when that is the variable Nitro read', async () => {
    vi.stubEnv('NITRO_APP_SECRET', CMS_EXAMPLE_APP_SECRET)
    await expect(start(CMS_EXAMPLE_APP_SECRET)).rejects.toThrow(/NITRO_APP_SECRET is the example value/)
  })

  it('starts with any other long secret, and says nothing about the secret', async () => {
    await start('a-secret-of-our-own-that-is-long-enough-0123456789')
    expect(warn.mock.calls.flat().join('\n')).not.toContain('APP_SECRET')
  })

  it('does not look at the secret when sign-in is external (the secret is not used then)', async () => {
    await start(CMS_EXAMPLE_APP_SECRET, { mode: 'external' })
  })

  it('warns, and starts, in development', async () => {
    await start(CMS_EXAMPLE_APP_SECRET, { env: 'development' })
    expect(warn.mock.calls.flat().join('\n')).toMatch(/NUXT_APP_SECRET is the example value from \.env\.example[\s\S]*refuses it/)
  })

  it('is quiet in development with a secret of its own, or with none (Nuxt makes one)', async () => {
    await start('a-secret-of-our-own-that-is-long-enough-0123456789', { env: 'development' })
    await start('', { env: 'development' })
    expect(warn).not.toHaveBeenCalled()
  })
})
