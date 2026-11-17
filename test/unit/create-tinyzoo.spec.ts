import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { main, USAGE, type Dependencies, type Prompts } from '../../packages/create-tinyzoo/src/create.mjs'

// `create-tinyzoo`: the questions, the flags that answer them, and what it does when something goes wrong.
// The prompts are a stand-in that answers from a list; the packed package, run for real, is
// `pnpm check:starter` (a site) and `pnpm check:consumer` (the packed package into a fresh folder).

let dir: string
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'create-tinyzoo-')) })
afterAll(() => { rmSync(dir, { recursive: true, force: true }) })

const CANCEL = Symbol('cancel')
/** Prompts that answer from `answers` in the order they are asked, and write down what was asked. */
function prompts(answers: unknown[]) {
  const asked: string[] = []
  const next = (kind: string, message: string) => {
    asked.push(`${kind}: ${message}`)
    if (!answers.length) throw new Error(`asked more than expected: ${kind} ${message}`)
    return Promise.resolve(answers.shift() as never)
  }
  const notes: string[] = []
  const ui: Prompts = {
    intro: (t) => { notes.push(`intro ${t}`) },
    outro: (m) => { notes.push(`outro ${m}`) },
    cancel: (m) => { notes.push(`cancel ${m}`) },
    isCancel: (v) => v === CANCEL,
    text: (o) => next('text', o.message),
    select: (o) => next('select', o.message),
    multiselect: (o) => next('multiselect', o.message),
    confirm: (o) => next('confirm', o.message),
    log: { info: (m) => { notes.push(`info ${m}`) }, step: (m) => { notes.push(`step ${m}`) }, warn: (m) => { notes.push(`warn ${m}`) } },
  }
  return { ui, asked, notes, left: () => answers.length }
}

let n = 0
function setup(extra: Partial<Dependencies> = {}) {
  const cwd = join(dir, `run-${++n}`)
  mkdirSync(cwd)
  const out: string[] = []
  const err: string[] = []
  const ran: string[] = []
  const deps: Dependencies = {
    cwd, env: { npm_config_user_agent: 'pnpm/10.0.0 npm/? node/v22.0.0' }, interactive: false,
    log: (m) => out.push(m), error: (m) => err.push(m),
    run: (command, args, at) => { ran.push(`${command} ${args.join(' ')}`); return Promise.resolve(true) },
    ...extra,
  }
  return { cwd, out, err, ran, deps }
}
const config = (cwd: string, folder: string) => readFileSync(join(cwd, folder, 'cms.config.ts'), 'utf8')

describe('without questions (--yes, or no terminal)', () => {
  it('makes the default site from a folder alone', async () => {
    const { cwd, out, ran, deps } = setup()
    expect(await main(['my-site', '--yes'], deps)).toBe(0)
    expect(config(cwd, 'my-site')).toContain("defineLocales({ default: 'cs', locales: ['cs', 'en'] })")
    expect(existsSync(join(cwd, 'my-site/seed/index.ts'))).toBe(true)
    expect(JSON.parse(readFileSync(join(cwd, 'my-site/package.json'), 'utf8')).dependencies.tinyzoo).toMatch(/^\^\d+\.\d+\.\d+$/)
    expect(out.join('\n')).toContain('pnpm install')
    expect(ran).toEqual([])
  })

  it('takes every answer from a flag', async () => {
    const { cwd, out, deps } = setup()
    expect(await main(['site', '--languages', 'de,en', '--presets', 'news,search', '--no-demo', '--yes'], deps)).toBe(0)
    expect(config(cwd, 'site')).toContain("defineLocales({ default: 'de', locales: ['de', 'en'] })")
    expect(existsSync(join(cwd, 'site/seed'))).toBe(false)
    expect(existsSync(join(cwd, 'site/app/components/global/BlockContact.vue'))).toBe(false)
    expect(out.join('\n')).toContain('pnpm db:generate')
  })

  it('runs without a terminal as it would with --yes', async () => {
    const { cwd, deps } = setup({ interactive: false })
    expect(await main(['site'], deps)).toBe(0)
    expect(existsSync(join(cwd, 'site/cms.config.ts'))).toBe(true)
  })

  it('writes the commands of the package manager that ran it, or of the one it is told', async () => {
    const a = setup({ env: { npm_config_user_agent: 'npm/10.9.0 node/v22.0.0' } })
    await main(['site', '--yes'], a.deps)
    expect(a.out.join('\n')).toContain('npm run db:migrate')
    expect(readFileSync(join(a.cwd, 'site/README.md'), 'utf8')).toContain('npm run db:migrate')
    const b = setup({ env: { npm_config_user_agent: 'npm/10.9.0 node/v22.0.0' } })
    await main(['site', '--yes', '--package-manager', 'yarn'], b.deps)
    expect(b.out.join('\n')).toContain('yarn db:migrate')
  })

  it('needs a folder', async () => {
    const { err, deps } = setup()
    expect(await main(['--yes'], deps)).toBe(1)
    expect(err.join('\n')).toMatch(/Give the site a folder/)
  })

  it('refuses a folder that is not empty and leaves it alone', async () => {
    const { cwd, err, deps } = setup()
    mkdirSync(join(cwd, 'taken'))
    writeFileSync(join(cwd, 'taken/mine.txt'), 'keep')
    expect(await main(['taken', '--yes'], deps)).toBe(1)
    expect(err.join('\n')).toMatch(/exists and is not empty/)
    expect(readdirSync(join(cwd, 'taken'))).toEqual(['mine.txt'])
  })

  it('refuses options that do not fit, with the usage', async () => {
    const { cwd, err, deps } = setup()
    expect(await main(['x', '--languages', 'de,en', '--demo', '--yes'], deps)).toBe(1)
    expect(err.join('\n')).toMatch(/Czech and English/)
    expect(await main(['x', '--presets', 'blog'], deps)).toBe(1)
    expect(await main(['x', '--wat'], deps)).toBe(1)
    expect(err.join('\n')).toContain(USAGE.split('\n')[0])
    expect(readdirSync(cwd)).toEqual([])
  })

  it('prints its usage for --help', async () => {
    const { out, deps } = setup()
    expect(await main(['--help'], deps)).toBe(0)
    expect(out.join('\n')).toContain('pnpm create tinyzoo')
  })
})

describe('installing', () => {
  it('installs only when asked, then writes the files the site needs (the schema and the typed client)', async () => {
    const { cwd, out, ran, deps } = setup()
    expect(await main(['site', '--presets', 'news', '--install', '--yes'], deps)).toBe(0)
    expect(ran).toEqual(['pnpm install', 'pnpm run db:generate', 'pnpm run cms:client'])
    const text = out.join('\n')
    expect(text).not.toMatch(/pnpm install|db:generate|cms:client/)
    expect(text).toContain('pnpm db:migrate')
    expect(existsSync(join(cwd, 'site/cms.config.ts'))).toBe(true)
  })

  it('has nothing to generate for the default site', async () => {
    const { ran, deps } = setup()
    await main(['site', '--install', '--yes'], deps)
    expect(ran).toEqual(['pnpm install'])
  })

  it('keeps the finished folder when the install fails, and says what to run', async () => {
    const { cwd, err, out, ran, deps } = setup({ run: (c, a) => { ran2.push(`${c} ${a.join(' ')}`); return Promise.resolve(false) } })
    const ran2: string[] = []
    expect(await main(['site', '--install', '--yes'], deps)).toBe(0)
    expect(ran2).toEqual(['pnpm install'])
    expect(ran).toEqual([])
    expect(existsSync(join(cwd, 'site/cms.config.ts'))).toBe(true)
    expect(err.join('\n')).toContain('run `pnpm install` in site yourself')
    expect(out.join('\n')).toContain('pnpm install')
  })

  it('says which generating step failed, and goes on to the next steps', async () => {
    const { err, out, deps } = setup({ run: (c, a) => Promise.resolve(a[1] !== 'db:generate') })
    expect(await main(['site', '--presets', 'none', '--install', '--yes'], deps)).toBe(0)
    expect(err.join('\n')).toContain('`pnpm run db:generate` did not finish')
    expect(out.join('\n')).toMatch(/pnpm db:generate/)
  })
})

describe('with questions', () => {
  const interactive = (answers: unknown[], extra: Partial<Dependencies> = {}) => {
    const p = prompts(answers)
    return { p, ...setup({ interactive: true, ui: p.ui, ...extra }) }
  }

  it('asks the folder, languages, parts, demo content and install, and uses the answers', async () => {
    const { p, cwd, ran, deps } = interactive(['shop', 'en,cs', ['news', 'forms'], true, true])
    expect(await main([], deps)).toBe(0)
    expect(p.asked).toEqual([
      'text: Where should the site go?',
      'text: Content languages (codes, the first one is the default)',
      'multiselect: Which parts should the site have? (pages, menus and settings are always in)',
      'confirm: Fill it with demo content? (a small bakery, in Czech and English)',
      'confirm: Install the dependencies with pnpm now?',
    ])
    expect(config(cwd, 'shop')).toContain("defineLocales({ default: 'en', locales: ['en', 'cs'] })")
    expect(config(cwd, 'shop')).toContain('formsPlugin()')
    expect(config(cwd, 'shop')).not.toContain('defineRedirects()')
    expect(existsSync(join(cwd, 'shop/seed/index.ts'))).toBe(true)
    expect(ran).toEqual(['pnpm install', 'pnpm run db:generate', 'pnpm run cms:client'])
    expect(p.notes[0]).toBe('intro create-tinyzoo')
    expect(p.notes.at(-1)).toMatch(/^outro ✓ created .*shop/)
  })

  it('does not ask what a flag answered', async () => {
    // the folder, languages, parts and demo content are given: only the install is left to ask
    const { p, cwd, deps } = interactive([false])
    expect(await main(['site', '--languages', 'cs', '--presets', 'all', '--no-demo'], deps)).toBe(0)
    expect(p.asked).toEqual(['confirm: Install the dependencies with pnpm now?'])
    expect(existsSync(join(cwd, 'site/seed'))).toBe(false)
  })

  it('skips the demo question when the first language has no demo content, and says why', async () => {
    const { p, cwd, deps } = interactive(['site', 'de,en', [], false])
    expect(await main([], deps)).toBe(0)
    expect(p.asked.some((a) => a.includes('demo content'))).toBe(false)
    expect(p.notes.some((m) => m.startsWith('info No demo content'))).toBe(true)
    expect(existsSync(join(cwd, 'site/seed'))).toBe(false)
  })

  it('asks the package manager only when nothing says which one ran it', async () => {
    const withAgent = interactive(['a', 'cs', [], false, false])
    await main([], withAgent.deps)
    expect(withAgent.p.asked.some((a) => a.startsWith('select'))).toBe(false)
    const without = interactive(['npm', 'b', 'cs', [], false, false], { env: {} })
    await main([], without.deps)
    expect(without.p.asked[0]).toBe('select: Which package manager?')
    expect(without.out.length + without.p.notes.length).toBeGreaterThan(0)
    expect(without.p.notes.at(-1)).toContain('npm run db:migrate')
  })

  it('ends at Ctrl-C with nothing written, whichever question it came at', async () => {
    for (const at of [0, 1, 2, 3, 4]) {
      const answers: unknown[] = ['site', 'cs,en', ['news'], true, true].slice(0, at)
      answers.push(CANCEL)
      const { p, cwd, deps } = interactive(answers)
      expect(await main([], deps)).toBe(0)
      expect(p.notes.at(-1)).toBe('cancel Cancelled. Nothing was written.')
      expect(readdirSync(cwd), `cancelled at question ${at}`).toEqual([])
    }
  })

  it('checks the answers as they are given (the folder must be free, the languages codes)', async () => {
    const seen: Array<(v: string | undefined) => string | undefined> = []
    const p = prompts(['site', 'cs', [], false, false])
    const text = p.ui.text
    p.ui.text = (o) => { if (o.validate) seen.push(o.validate); return text(o) }
    const { cwd, deps } = setup({ interactive: true, ui: p.ui })
    mkdirSync(join(cwd, 'full'))
    writeFileSync(join(cwd, 'full/x'), '')
    await main([], deps)
    expect(seen[0]!('full')).toMatch(/exists and is not empty/)
    expect(seen[0]!('free')).toBeUndefined()
    expect(seen[0]!('')).toBeUndefined()
    expect(seen[1]!('cs,,en')).toBeUndefined()
    expect(seen[1]!('cs,cs')).toMatch(/twice/)
    expect(seen[1]!('English')).toMatch(/not a language code/)
  })
})
