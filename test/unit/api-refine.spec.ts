import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cmsDeprecations, defineEntity, defineSingleton, eq, f, resetCmsDeprecations } from 'tinyzoo'

// The API refinements before the 1.0 freeze (docs/roadmap.md "0.6 P", "After review"): decimals,
// the two crons, the `singleton` option, `defineForm`'s rows, what an `access` rule is given.
// The types are asserted in surface-types.spec.ts; the HTTP behaviour (the OpenAPI server) in
// test/api/api-refine.spec.ts.

vi.mock('../../packages/cms/node_modules/@nuxt/kit', () => ({
  defineNuxtModule: (def: Record<string, unknown>) => def,
  addComponentsDir: () => {}, addServerHandler: () => {}, addServerPlugin: () => {}, extendPages: () => {}, addTypeTemplate: () => {}, addTemplate: () => {}, hasNuxtModule: () => false,
}))

const root = join(import.meta.dirname, '../..')

describe('f.number({ int: false }): a decimal', () => {
  const price = f.number({ int: false, min: 0, max: 1000 })
  const parse = (v: unknown, mode: 'create' | 'update' = 'create') => price.zod(mode).safeParse(v)

  it('takes a number or a numeric string and stores the string, as the database gives it back', () => {
    expect(parse(19.99)).toMatchObject({ success: true, data: '19.99' })
    expect(parse('19.99')).toMatchObject({ success: true, data: '19.99' })
    expect(parse(' 7 ')).toMatchObject({ success: true, data: '7' })
    expect(parse('0.50')).toMatchObject({ success: true, data: '0.50' })
    expect(parse(0)).toMatchObject({ success: true, data: '0' })
  })

  it('accepts what the admin sends back untouched: the string it was given', () => {
    // The content API and a select return "19.99"; the number box sends a number once edited, the string until then.
    expect(parse('1000')).toMatchObject({ success: true })
    expect(parse('1000.01').success).toBe(false)
  })

  it('refuses what is not a number, with a message', () => {
    for (const bad of ['', 'abc', '1,5', '1e3', '--1', '12.', true, null, {}]) expect(parse(bad).success, JSON.stringify(bad)).toBe(false)
    const out = parse('abc')
    expect(out.success).toBe(false)
    expect((out as any).error.issues[0].message).toBe('Enter a number')
  })

  it('keeps min and max, as a number or a string', () => {
    expect(parse(-1).success).toBe(false)
    expect(parse('-0.01').success).toBe(false)
    expect((parse(2000) as any).error.issues[0].message).toBe('Enter a number from 0 to 1000')
  })

  it('is optional on update and nullable with .optional()', () => {
    expect(price.zod('update').safeParse(undefined).success).toBe(true)
    expect(price.optional().zod('create').safeParse(null).success).toBe(true)
    expect(price.zod('create').safeParse(undefined).success).toBe(false)
  })

  it('keeps a whole number whole, and a number a number', () => {
    const seats = f.number({ min: 0 })
    expect(seats.zod('create').safeParse(3)).toMatchObject({ success: true, data: 3 })
    expect(seats.zod('create').safeParse('3').success).toBe(false)
    expect(seats.zod('create').safeParse(3.5).success).toBe(false)
  })

  it('is a numeric(12,2) column, and a default is written as a string', () => {
    expect(price.spec?.base).toEqual({ kind: 'numeric', precision: 12, scale: 2 })
    expect(f.number({ int: false }).withDefault('0').default).toBe('0')
  })

  it('goes through the entity\'s insert and update schemas', () => {
    const e = defineEntity('thing', { label: 'Things', titleField: 'name', fields: { name: f.text({ required: true }), price: f.number({ int: false }) } })
    expect((e.insertSchema as any).parse({ name: 'a', price: 4.5 })).toEqual({ name: 'a', price: '4.5' })
    expect((e.updateSchema as any).parse({ price: '4.50' })).toEqual({ price: '4.50' })
  })
})

describe('`singleton: true` on defineEntity (removed in 1.0)', () => {
  const fields = { name: f.text({ required: true }) }

  it('is a type error, and fails at once with what to write instead', () => {
    // @ts-expect-error the option is gone: defineSingleton makes a global
    expect(() => defineEntity('settings', { label: 'Settings', titleField: 'name', singleton: true, fields }))
      .toThrow(`defineEntity('settings', { singleton: true }) was removed in 1.0: write defineSingleton('settings', { … }) with the same options. See "From 0.7 to 1.0": https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/upgrading.md#from-07-to-10`)
  })

  it('leaves defineSingleton and a collection as they were', () => {
    expect(defineSingleton('settings', { label: 'Settings', titleField: 'name', fields }).singleton).toBe(true)
    expect(defineEntity('posts', { label: 'Posts', titleField: 'name', fields }).singleton).toBeUndefined()
  })
})

describe('a field of a public collection named like a list parameter (an error from 1.0)', () => {
  it('fails at once, naming the field and the parameter', () => {
    for (const key of ['page', 'limit', 'sort', 'dir', 'q']) {
      expect(() => defineEntity('posts', { label: 'Posts', titleField: 'title', content: { public: true }, fields: { title: f.text(), [key]: f.text() } }))
        .toThrow(`The field "${key}" of the public collection "posts" has the name of a parameter of the content API's list (?${key}=). Rename the field`)
      expect(() => defineEntity('posts', { label: 'Posts', titleField: 'title', content: { public: true }, fields: { title: f.text(), [key]: f.text() } }))
        .toThrow('A rename is a migration: see "Renaming a field": https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/upgrading.md#renaming-a-field')
    }
  })

  it('is allowed in a collection that is not public', () => {
    expect(defineEntity('notes', { label: 'Notes', titleField: 'title', fields: { title: f.text(), sort: f.number() } }).name).toBe('notes')
  })

  it('is allowed in a public global, which has no list', () => {
    for (const key of ['page', 'limit', 'sort', 'dir', 'q']) {
      const settings = defineSingleton('settings', { label: 'Settings', titleField: 'title', content: { public: true }, fields: { title: f.text(), [key]: f.text() } })
      expect(settings.singleton).toBe(true)
      expect(Object.keys(settings.fields)).toContain(key)
    }
  })
})

describe('what sites show', () => {
  /** Every `.ts`, `.vue` and `.md` file under these paths of the repository (not dependencies or build output). */
  function sourcesUnder(paths: string[]): string[] {
    const skip = new Set(['node_modules', '.nuxt', '.output', 'dist', '.cache', '.git'])
    const walk = (p: string): string[] => {
      if (!statSync(p, { throwIfNoEntry: false })?.isDirectory()) return /\.(ts|vue|md|mjs)$/.test(p) ? [p] : []
      return readdirSync(p).filter((n) => !skip.has(n)).flatMap((n) => walk(join(p, n)))
    }
    return paths.flatMap((p) => walk(join(root, p)))
  }

  it('makes a global with defineSingleton: the docs, the website, the playground and the starter never write `singleton: true`', () => {
    const files = sourcesUnder(['docs', 'site', 'playground', 'packages/cms/starter', 'packages/cms/README.md', 'README.md', 'packages/create-tinyzoo'])
    expect(files.length).toBeGreaterThan(50)
    const found = files
      .filter((f) => !/docs[\\/](roadmap|upgrading|api-surface)\.md$/.test(f)) // the history, and the pages that name the deprecated option
      .filter((f) => /\bsingleton:\s*true\b/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(root, f))
    expect(found).toEqual([])
  })

  it('calls the typed client `createClient` and the runtime `createCmsClient`: no alias for either', () => {
    const client = readFileSync(join(root, 'packages/client/src/index.ts'), 'utf8')
    expect(client).toMatch(/export function createCmsClient</)
    expect(client).not.toMatch(/export (?:function|const) createClient\b/)
  })
})

describe('the cron of the scheduled tasks', () => {
  const env = { ...process.env }
  beforeEach(() => resetCmsDeprecations())
  afterEach(() => {
    for (const k of ['CMS_SCHEDULER_CRON', 'CMS_RETENTION_CRON']) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k] }
    resetCmsDeprecations()
  })

  /** Runs the module's setup and its `nitro:config` hook; returns the scheduled tasks Nitro is given. */
  async function tasks(options: Record<string, unknown> = {}) {
    const mod = (await import(/* @vite-ignore */ join(root, 'packages/cms/module'))).default as any
    let nitroConfig: ((nitro: any) => void) | undefined
    const nuxt = {
      options: { rootDir: '/nonexistent-tinyzoo-site', alias: {}, runtimeConfig: { public: {} } },
      hook: (name: string, fn: (nitro: any) => void) => { if (name === 'nitro:config') nitroConfig = fn },
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try { await mod.setup({ ...mod.defaults, ...options }, nuxt) } finally { warn.mockRestore() }
    const nitro: any = {}
    nitroConfig!(nitro)
    return Object.fromEntries(Object.entries(nitro.scheduledTasks as Record<string, string[]>).map(([cron, names]) => [names.join(','), cron]))
  }

  it('is every minute and 03:17 daily by default', async () => {
    delete process.env.CMS_SCHEDULER_CRON; delete process.env.CMS_RETENTION_CRON
    expect(await tasks()).toEqual({ 'cms:scheduled,cms:media-sizes': '* * * * *', 'cms:retention': '17 3 * * *' })
    expect(cmsDeprecations()).toEqual([])
  })

  it('is set by `scheduler.cron` and `retention.cron`', async () => {
    delete process.env.CMS_SCHEDULER_CRON; delete process.env.CMS_RETENTION_CRON
    expect(await tasks({ scheduler: { cron: '*/5 * * * *' }, retention: { cron: '30 2 * * *' } })).toEqual({ 'cms:scheduled': '*/5 * * * *', 'cms:media-sizes': '* * * * *', 'cms:retention': '30 2 * * *' })
    expect(cmsDeprecations()).toEqual([])
  })

  it('stops the build when an old variable is still set (removed in 1.0), naming the option to write instead', async () => {
    process.env.CMS_SCHEDULER_CRON = '*/2 * * * *'; delete process.env.CMS_RETENTION_CRON
    await expect(tasks()).rejects.toThrow("The variable CMS_SCHEDULER_CRON was removed in 1.0: set `cms: { scheduler: { cron: '*/2 * * * *' } }` in nuxt.config.ts and remove the variable.")
    delete process.env.CMS_SCHEDULER_CRON; process.env.CMS_RETENTION_CRON = '0 4 * * *'
    await expect(tasks({ retention: { cron: '0 4 * * *' } })).rejects.toThrow("The variable CMS_RETENTION_CRON was removed in 1.0: set `cms: { retention: { cron: '0 4 * * *' } }` in nuxt.config.ts and remove the variable.")
    // the address works from a site's terminal, not a path inside tinyzoo's repository
    await expect(tasks({ retention: { cron: '0 4 * * *' } })).rejects.toThrow('See "From 0.7 to 1.0": https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/upgrading.md#from-07-to-10')
  })
})

describe('`FormOptions` from `tinyzoo` (removed in 1.0)', () => {
  it('is only in tinyzoo/forms', () => {
    // @ts-expect-error the re-export from tinyzoo is gone
    type Old = import('tinyzoo').FormOptions<Record<string, never>>
    type New = import('tinyzoo/forms').FormOptions<Record<string, never>>
    const old: Old | undefined = undefined
    const current: New | undefined = undefined
    expect([old, current]).toEqual([undefined, undefined])
  })
})

describe('`cms.databaseUrl` (removed in 1.0)', () => {
  async function setup(options: Record<string, unknown>) {
    const mod = (await import(/* @vite-ignore */ join(root, 'packages/cms/module'))).default as any
    const nuxt = { options: { rootDir: '/nonexistent-tinyzoo-site', alias: {}, runtimeConfig: { public: {} as Record<string, any> } as Record<string, any> }, hook: () => {} }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try { await mod.setup({ ...mod.defaults, ...options }, nuxt) } finally { warn.mockRestore() }
    return nuxt.options.runtimeConfig.cms
  }

  it('stops the build with what to do instead', async () => {
    await expect(setup({ databaseUrl: 'postgres://cfg/db' })).rejects.toThrow('`cms.databaseUrl` was removed in 1.0: delete it from nuxt.config.ts and set DATABASE_URL (or NUXT_CMS_DATABASE_URL) in the environment.\nSee "From 0.7 to 1.0": https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/upgrading.md#from-07-to-10')
  })

  it('leaves the runtime value empty in the build, so NUXT_CMS_DATABASE_URL still binds at runtime', async () => {
    expect((await setup({})).databaseUrl).toBe('')
  })
})

describe('forms.notifyTo', () => {
  async function runtime(options: Record<string, unknown>) {
    const mod = (await import(/* @vite-ignore */ join(root, 'packages/cms/module'))).default as any
    const nuxt = { options: { rootDir: '/nonexistent-tinyzoo-site', alias: {}, runtimeConfig: { public: {} as Record<string, any> } as Record<string, any> }, hook: () => {} }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try { await mod.setup({ ...mod.defaults, ...options }, nuxt) } finally { warn.mockRestore() }
    return nuxt.options.runtimeConfig.cms
  }

  it('takes one address, a comma-separated string, or a list; the runtime value (and the variable) is the comma-separated string', async () => {
    expect((await runtime({ forms: { notifyTo: 'a@example.com' } })).forms.notifyTo).toBe('a@example.com')
    expect((await runtime({ forms: { notifyTo: 'a@example.com, b@example.com' } })).forms.notifyTo).toBe('a@example.com, b@example.com')
    expect((await runtime({ forms: { notifyTo: ['a@example.com', 'b@example.com'] } })).forms.notifyTo).toBe('a@example.com,b@example.com')
    expect((await runtime({})).forms.notifyTo).toBe('')
    expect((await runtime({ forms: { notifyTo: [] } })).forms.notifyTo).toBe('')
  })
})

describe('what an `access` rule is given', () => {
  // The server hands it `CmsAccessUser`: the session's person with `base`, and what an external sign-in left out filled in empty.
  // (Nitro's helpers are stood in for, as in roles-server.spec.ts.)
  const utils = join(root, 'packages/cms/server/utils')
  const load = (name: string): Promise<any> => import(/* @vite-ignore */ join(utils, name))
  const g = globalThis as any
  let seen: any

  beforeEach(async () => {
    const rolesUtil = await load('cmsRoles.ts')
    g.useCms = () => ({ reg: { roles: null } })
    g.cmsAuthMode = () => 'builtin'
    g.createError = (o: any) => Object.assign(new Error(o.statusMessage), o)
    g.requireCmsUser = (event: any) => event.user
    for (const [k, v] of Object.entries(rolesUtil)) g[k] = v
    for (const [k, v] of Object.entries(await load('cmsAccessTokens.ts'))) g[k] = v
    seen = undefined
  })

  const entity = () => defineEntity('note', {
    label: 'Notes', titleField: 'title', fields: { title: f.text() },
    access: { read: ({ user, table }) => { seen = user; return eq(table.createdBy, user.id) } },
  }) as any

  it('has id, email, name, role, base and locale, and what else the session carries', async () => {
    const crud = await load('cmsCrud.ts')
    const res = crud.accessWhere(entity(), 'read', { id: 'u1', email: 'ada@example.com', name: 'Ada', role: 'editor', locale: 'cs', tenant: 'acme' })
    expect(res.allowed).toBe(true)
    expect(seen).toEqual({ id: 'u1', email: 'ada@example.com', name: 'Ada', role: 'editor', base: 'editor', locale: 'cs', tenant: 'acme' })
  })

  it('fills in what an external sign-in did not send (email and name empty, locale null) so the types are true', async () => {
    const crud = await load('cmsCrud.ts')
    crud.accessWhere(entity(), 'read', { id: 'u2', role: 'editor' })
    expect(seen).toMatchObject({ id: 'u2', email: '', name: '', locale: null, base: 'editor' })
    crud.accessWhere(entity(), 'read', { id: 'u3', email: 'x@example.com', role: 'author' })
    expect(seen).toMatchObject({ email: 'x@example.com', name: 'x@example.com', base: 'author' })
  })
})
