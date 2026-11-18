import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, cpSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { basename, join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  ADDRESS_WORDS, applyMarkers, commandsFor, detectPackageManager, InitError, INIT_USAGE, nextSteps, PRESET_NAMES, packageNameOf, newAppSecret,
  parseInitArgs, parseLanguages, parsePresets, resolveOptions, scaffold,
} from '../../packages/cms/cli/init.mjs'
import { WORDS } from '../../packages/cms/starter/app/utils/site'

// `tinyzoo init` and `create-tinyzoo`: the options, the markers in the starter and the sites made from it.
// The sites are checked in full (installed, built, started) by `pnpm check:starter`; here, what is cheap to see.

// A hook into the renames of cli/init.mjs, to make one of them fail (the others go to the real thing).
const hook = vi.hoisted(() => ({ rename: undefined as undefined | ((from: string, to: string) => void) }))
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, renameSync: (from: string, to: string) => { hook.rename?.(from, to); return actual.renameSync(from, to) } }
})

const starterDir = join(import.meta.dirname, '../../packages/cms/starter')
let dir: string
let n = 0
const fresh = () => join(dir, `site-${++n}`)
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'tinyzoo-init-')) })
afterAll(() => { rmSync(dir, { recursive: true, force: true }) })

function* walk(root: string): Generator<string> {
  for (const name of readdirSync(root)) {
    // (a developer's starter has the installed packages and what Nuxt writes next to its files)
    if (['node_modules', '.nuxt', '.output', '.data', '.cms-uploads', '.cms-mail'].includes(name)) continue
    const path = join(root, name)
    if (statSync(path).isDirectory()) yield* walk(path)
    else yield path
  }
}
const read = (site: string, path: string) => readFileSync(join(site, path), 'utf8')
const make = (options: Partial<Parameters<typeof scaffold>[0]> = {}) => {
  const choices = resolveOptions({ languages: options.languages, presets: options.presets, demo: options.demo })
  const result = scaffold({ starterDir, version: '1.2.3', ...choices, ...options, dest: fresh() })
  return result
}

describe('the options', () => {
  it('reads every flag, with a value after a space or an equals sign', () => {
    const args = parseInitArgs(['my-site', '--languages', 'cs, en,de', '--presets=news,search', '--no-demo', '--package-manager', 'npm'])
    expect(args).toMatchObject({ folder: 'my-site', languages: ['cs', 'en', 'de'], presets: ['news', 'search'], demo: false, packageManager: 'npm', yes: false, install: undefined })
    expect(parseInitArgs(['--demo', 'x']).demo).toBe(true)
    expect(parseInitArgs([]).folder).toBeUndefined()
  })

  it('takes --install and --yes only for create-tinyzoo: `tinyzoo init` never asks and never installs', () => {
    expect(parseInitArgs(['a', '--install'], { create: true }).install).toBe(true)
    expect(parseInitArgs(['a', '--no-install'], { create: true }).install).toBe(false)
    expect(parseInitArgs(['a', '-y'], { create: true }).yes).toBe(true)
    expect(parseInitArgs(['a', '--yes'], { create: true }).yes).toBe(true)
    for (const flag of ['--install', '--no-install', '--yes', '-y']) expect(() => parseInitArgs(['a', flag]), flag).toThrow(/Unknown option/)
  })

  it('has no undocumented aliases: --pm is refused, and the flags of the usage text are the flags it reads', () => {
    expect(() => parseInitArgs(['a', '--pm', 'npm'])).toThrow(/Unknown option --pm/)
    expect(() => parseInitArgs(['a', '--pm', 'npm'], { create: true })).toThrow(/Unknown option --pm/)
    for (const flag of ['--languages', '--presets', '--demo', '--no-demo', '--package-manager']) expect(INIT_USAGE).toContain(flag)
    expect(INIT_USAGE).not.toMatch(/--yes|--pm\b|--install/)
  })

  it('refuses what it does not understand', () => {
    expect(() => parseInitArgs(['--nope'])).toThrow(/Unknown option --nope/)
    expect(() => parseInitArgs(['--languages'])).toThrow(/needs a value/)
    expect(() => parseInitArgs(['--languages', '--no-demo'])).toThrow(/needs a value/)
    expect(() => parseInitArgs(['a', 'b'])).toThrow(/Only one folder/)
    expect(() => parseInitArgs(['--package-manager', 'make'])).toThrow(/Unknown package manager/)
    expect(() => parseLanguages('cs,CS-x')).toThrow(/not a language code/)
    expect(() => parseLanguages('cs,cs')).toThrow(/twice/)
    expect(() => parseLanguages(' , ')).toThrow(/at least one/)
    expect(() => parsePresets('news,blog')).toThrow(/Unknown preset "blog"/)
    expect(() => parsePresets('pages')).toThrow(/Unknown preset "pages"/)
  })

  it('knows all, none and the order of the presets', () => {
    expect(parsePresets('all')).toEqual(PRESET_NAMES)
    expect(parsePresets('none')).toEqual([])
    expect(parsePresets('search,news')).toEqual(['news', 'search'])
  })

  it('fills in the defaults, and refuses demo content in a language it does not have', () => {
    expect(resolveOptions()).toEqual({ languages: ['cs', 'en'], presets: PRESET_NAMES, demo: true })
    expect(resolveOptions({ languages: ['en'] }).demo).toBe(true)
    expect(resolveOptions({ languages: ['de', 'en'] }).demo).toBe(false)
    expect(resolveOptions({ languages: ['de', 'en'], demo: false }).demo).toBe(false)
    expect(() => resolveOptions({ languages: ['de', 'en'], demo: true })).toThrow(/Czech and English/)
  })

  it('finds the package manager from the user agent, pnpm when it cannot', () => {
    expect(detectPackageManager('npm/10.9.0 node/v22.0.0 darwin arm64')).toBe('npm')
    expect(detectPackageManager('yarn/4.1.0 npm/? node/v22.0.0')).toBe('yarn')
    expect(detectPackageManager('bun/1.2.0 npm/? node/v22')).toBe('bun')
    expect(detectPackageManager('')).toBe('pnpm')
    expect(detectPackageManager(undefined)).toBe('pnpm')
  })

  it('names the package after the folder', () => {
    expect(packageNameOf('/a/b/Moje Pekárna!')).toBe('moje-pek-rna')
    expect(packageNameOf('/a/b/---')).toBe('my-site')
  })
})

describe('the markers', () => {
  const on = new Set(['news'])
  it('keeps the lines of the flags that are on, in every comment style', () => {
    const text = ['a', '// #if news', 'b', '// #endif', '<!-- #if forms -->', 'c', '<!-- #endif -->', '# #if news', 'd', '# #endif', '/* #if forms */', 'e', '/* #endif */', 'f'].join('\n')
    expect(applyMarkers(text, on)).toBe('a\nb\nd\nf')
  })

  it('nests, and a flag with ! is what stays without it', () => {
    const text = ['// #if news', 'a', '// #if forms', 'b', '// #endif', 'c', '// #endif', '// #if !forms', 'd', '// #endif', '// #if !news', 'e', '// #endif'].join('\n')
    expect(applyMarkers(text, new Set(['news']))).toBe('a\nc\nd')
    expect(applyMarkers(text, new Set(['news', 'forms']))).toBe('a\nb\nc')
    expect(applyMarkers(text, new Set())).toBe('d\ne')
  })

  it('leaves no run of empty lines where a block was', () => {
    expect(applyMarkers('a\n\n// #if news\nb\n// #endif\n\nc', new Set())).toBe('a\n\nc')
  })

  it('does not touch code that only looks like a marker', () => {
    const text = 'const a = 1 // #if news\n#if news\nconst b = `# #if`'
    expect(applyMarkers(text, new Set())).toBe(text)
  })

  it('says where a marker is wrong', () => {
    expect(() => applyMarkers('a\n// #if blog\nb\n// #endif', on, 'x.ts')).toThrow(/x\.ts:2: unknown flag "blog"/)
    expect(() => applyMarkers('// #if\n// #endif', on, 'x.ts')).toThrow(/unknown flag/)
    expect(() => applyMarkers('a\n// #endif', on, 'x.ts')).toThrow(/x\.ts:2: #endif without #if/)
    expect(() => applyMarkers('// #if news\na', on, 'x.ts')).toThrow(/#if without #endif/)
  })
})

describe('the commands in the README', () => {
  it('stay as they are for pnpm and follow the package manager otherwise', () => {
    const text = 'pnpm install\npnpm db:migrate             # create\n`pnpm seed --dry-run` and SEED=1 pnpm seed\npnpm dev'
    expect(commandsFor(text, 'pnpm')).toBe(text)
    expect(commandsFor(text, 'npm')).toBe('npm install\nnpm run db:migrate             # create\n`npm run seed -- --dry-run` and SEED=1 npm run seed\nnpm run dev')
    expect(commandsFor(text, 'yarn')).toBe('yarn install\nyarn db:migrate             # create\n`yarn seed --dry-run` and SEED=1 yarn seed\nyarn dev')
    expect(commandsFor(text, 'bun')).toBe('bun install\nbun run db:migrate             # create\n`bun run seed --dry-run` and SEED=1 bun run seed\nbun run dev')
  })
})

describe('the words of the website match the addresses init writes', () => {
  it('app/utils/site.ts and cli/init.mjs say the same for every language they both know', () => {
    for (const [code, words] of Object.entries(ADDRESS_WORDS)) {
      expect(WORDS[code]?.newsPath, `news in ${code}`).toBe(words.news)
      expect(WORDS[code]?.searchPath, `search in ${code}`).toBe(words.search)
    }
  })
})

type Combo = { name: string, languages: string[], presets: string[], demo: boolean, regenerate: { schema: boolean, client: boolean } }
const combos: Combo[] = [
  { name: 'the defaults', languages: ['cs', 'en'], presets: PRESET_NAMES, demo: true, regenerate: { schema: false, client: false } },
  { name: 'one language, no demo, no parts', languages: ['en'], presets: [], demo: false, regenerate: { schema: true, client: true } },
  { name: 'three languages, every part', languages: ['cs', 'en', 'de'], presets: PRESET_NAMES, demo: true, regenerate: { schema: false, client: true } },
  { name: 'English first, news and redirects', languages: ['en', 'cs'], presets: ['news', 'redirects'], demo: true, regenerate: { schema: true, client: true } },
  { name: 'German first (no demo), search only', languages: ['de', 'en'], presets: ['search'], demo: false, regenerate: { schema: true, client: true } },
  { name: 'Czech and English without forms', languages: ['cs', 'en'], presets: ['news', 'redirects', 'search'], demo: true, regenerate: { schema: true, client: true } },
]

describe.each(combos)('a site with $name', ({ languages, presets, demo, regenerate }) => {
  const has = (p: string) => presets.includes(p)
  let site: string
  beforeAll(() => { site = make({ languages, presets, demo }).dest })

  it('says what has to be generated before it starts', () => {
    expect(make({ languages, presets, demo }).regenerate).toEqual(regenerate)
    expect(existsSync(join(site, 'server/db/schema.ts'))).toBe(!regenerate.schema)
    expect(existsSync(join(site, 'server/db/migrations'))).toBe(!regenerate.schema)
    expect(existsSync(join(site, 'app/lib/cms-content.ts'))).toBe(!regenerate.client)
  })

  it('has the files of its parts and no others, and no marker is left', () => {
    expect(existsSync(join(site, 'seed/index.ts'))).toBe(demo)
    expect(existsSync(join(site, 'seed/media/hero.jpg'))).toBe(demo)
    expect(existsSync(join(site, 'app/pages/search.vue'))).toBe(has('search'))
    expect(existsSync(join(site, 'app/components/global/BlockContact.vue'))).toBe(has('forms'))
    expect(existsSync(join(site, '.gitignore'))).toBe(true)
    expect(existsSync(join(site, 'gitignore.txt'))).toBe(false)
    for (const path of walk(site)) {
      if (!/\.(ts|vue|md|mjs|css)$|\.env\.example$/.test(path)) continue
      expect(readFileSync(path, 'utf8'), relative(site, path)).not.toMatch(/^\s*(?:\/\/|#|<!--|\/\*)\s*#(?:if|endif)\b/m)
    }
    expect(readdirSync(dir).filter((f) => f.startsWith('.tinyzoo-init-'))).toEqual([])
  })

  it('writes its languages where the site reads them', () => {
    const list = languages.map((l) => `'${l}'`).join(', ')
    expect(read(site, 'cms.config.ts')).toContain(`defineLocales({ default: '${languages[0]}', locales: [${list}] })`)
    expect(read(site, 'app/utils/site.ts')).toContain(`export const LANGUAGES: string[] = [${list}]`)
    const config = read(site, 'cms.config.ts')
    expect(config.includes("defineEntity('news'")).toBe(has('news'))
    expect(config.includes('formsPlugin()')).toBe(has('forms'))
    expect(config.includes('defineRedirects()')).toBe(has('redirects'))
    if (has('news')) {
      const word = (l: string) => (ADDRESS_WORDS as Record<string, { news: string }>)[l]?.news ?? 'news'
      for (const l of languages) expect(config).toContain(`${l}: '/${word(l)}/:slug'`)
      expect(read(site, 'nuxt.config.ts')).toContain(`${languages[0]}: '/${word(languages[0]!)}'`)
      if (languages[1]) expect(read(site, 'nuxt.config.ts')).toContain(`${languages[1]}: '/${languages[1]}/${word(languages[1])}'`)
    }
    else expect(read(site, 'nuxt.config.ts')).not.toContain('cms: { sitemap')
    if (has('search')) {
      const search = read(site, 'app/pages/search.vue')
      const word = (l: string) => (ADDRESS_WORDS as Record<string, { search: string }>)[l]?.search ?? 'search'
      expect(search).toContain(`path: '/${word(languages[0]!)}'`)
      expect(search.includes('alias')).toBe(languages.length > 1)
      // The search page stays out of /sitemap.xml, at its address in every language.
      const addresses = languages.map((l, i) => `'${i ? `/${l}` : ''}/${word(l)}'`).join(', ')
      expect(read(site, 'nuxt.config.ts')).toContain(`sitemap: { exclude: [${addresses}] }`)
    }
    else expect(read(site, 'nuxt.config.ts')).not.toContain('sitemap: { exclude')
  })

  it('pins the released versions and names itself after its folder', () => {
    const pkg = JSON.parse(read(site, 'package.json'))
    expect(pkg.name).toBe(basename(site))
    expect(pkg.dependencies.tinyzoo).toBe('^1.2.3')
    expect(pkg.dependencies['@tinyzoo/client']).toBe('^1.2.3')
    expect(JSON.stringify(pkg)).not.toContain('workspace:')
    expect('seed' in pkg.scripts).toBe(demo)
    expect(Object.keys(pkg.scripts)).toContain('db:generate')
  })
})

describe('what the default site is', () => {
  it('the starter itself, without its markers', () => {
    const site = make().dest
    const on = new Set([...PRESET_NAMES, 'demo'])
    const skip = new Set(['package.json', 'gitignore.txt'])
    const skipDirs = ['node_modules', '.nuxt', '.output', '.data', '.cms-uploads', '.cms-mail']
    let compared = 0
    for (const path of walk(starterDir)) {
      const rel = relative(starterDir, path)
      if (skip.has(rel) || skipDirs.some((d) => rel.split('/').includes(d)) || rel === '.env') continue
      expect(existsSync(join(site, rel)), `${rel} is in the site`).toBe(true)
      const [a, b] = [readFileSync(path), readFileSync(join(site, rel))]
      // (the README's `cp .env.example .env` goes: the site has its .env already)
      const expected = rel === 'README.md' ? a.toString().replace(/^cp \.env\.example \.env .*\n/m, '') : a.toString()
      if (/\.(ts|vue|md|mjs|css)$|\.env\.example$/.test(rel)) expect(b.toString(), rel).toBe(applyMarkers(expected, on, rel))
      else expect(b.equals(a), rel).toBe(true)
      compared++
    }
    expect(compared).toBeGreaterThan(30)
  })

  it('has the generated files of the starter, so they match its cms.config.ts', () => {
    const site = make().dest
    expect(existsSync(join(site, 'server/db/migrations/0000_init.sql'))).toBe(true)
    expect(readFileSync(join(site, 'app/lib/cms-content.ts'), 'utf8')).toBe(readFileSync(join(starterDir, 'app/lib/cms-content.ts'), 'utf8'))
  })

  it('has AGENTS.md for a coding assistant, whatever the options, with links that work outside the repository', () => {
    for (const site of [make().dest, make({ languages: ['en'], presets: [], demo: false, packageManager: 'npm' }).dest]) {
      const agents = read(site, 'AGENTS.md')
      expect(agents).toContain('cms.config.ts')
      // a site has no docs/ folder: every link is absolute
      const links = [...agents.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]!)
      expect(links.length).toBeGreaterThan(3)
      for (const link of links) expect(link, link).toMatch(/^https:\/\/github\.com\/tinyzookeeper\/tinyzoo(\/|$)/)
    }
  })

  it('writes the README in the commands of the package manager', () => {
    const npm = make({ packageManager: 'npm' }).dest
    expect(read(npm, 'README.md')).toContain('npm run db:migrate')
    expect(read(npm, 'README.md')).toContain('npm run seed -- --dry-run')
    expect(read(npm, 'README.md')).not.toContain('pnpm')
    expect(read(make().dest, 'README.md')).toContain('pnpm db:migrate')
  })
})

describe('the folder', () => {
  it('is refused when it is not empty, and left as it was', () => {
    const dest = fresh()
    mkdirSync(dest)
    writeFileSync(join(dest, 'mine.txt'), 'keep')
    expect(() => scaffold({ dest, starterDir, version: '1.0.0', ...resolveOptions() })).toThrow(/exists and is not empty/)
    expect(readdirSync(dest)).toEqual(['mine.txt'])
    expect(readdirSync(dir).filter((f) => f.startsWith('.tinyzoo-init-'))).toEqual([])
  })

  it('may be an empty folder that exists: the folder itself stays (same folder, no work folder left), the site goes into it', () => {
    const empty = fresh()
    mkdirSync(empty)
    const before = statSync(empty)
    const { dest } = scaffold({ dest: empty, starterDir, version: '1.0.0', ...resolveOptions() })
    expect(dest).toBe(empty)
    expect(existsSync(join(empty, 'cms.config.ts'))).toBe(true)
    expect(existsSync(join(empty, '.gitignore'))).toBe(true)
    expect(readdirSync(empty).filter((f) => f.startsWith('.tinyzoo-init-'))).toEqual([])
    // not deleted and made again: the same folder (a shell standing in it, its permissions and mount stay)
    const after = statSync(empty)
    expect([after.ino, after.dev]).toEqual([before.ino, before.dev])
    // (and the same site as into a folder that did not exist)
    const other = make().dest
    expect(readdirSync(empty).sort()).toEqual(readdirSync(other).sort())
    expect(readFileSync(join(empty, 'cms.config.ts'), 'utf8')).toBe(readFileSync(join(other, 'cms.config.ts'), 'utf8'))
  })

  it('may be `.`: run inside an empty folder, `tinyzoo init .` makes the site there and the folder stays', () => {
    const empty = fresh()
    mkdirSync(empty)
    const before = statSync(empty)
    const code = `import { resolveOptions, scaffold, nextSteps } from ${JSON.stringify(pathToFileURL(join(starterDir, '../cli/init.mjs')).href)}
      const r = scaffold({ dest: '.', starterDir: ${JSON.stringify(starterDir)}, version: '1.0.0', ...resolveOptions() })
      console.log(JSON.stringify({ dest: r.dest, steps: nextSteps({ folder: '.', packageManager: 'pnpm', demo: true, regenerate: r.regenerate }) }))`
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: empty, encoding: 'utf8' })
    expect(run.stderr).toBe('')
    expect(run.status).toBe(0)
    const out = JSON.parse(run.stdout)
    expect(readFileSync(join(empty, 'package.json'), 'utf8')).toContain(`"name": "${basename(empty)}"`)
    expect(existsSync(join(empty, 'cms.config.ts'))).toBe(true)
    expect(existsSync(join(empty, '.env'))).toBe(true)
    expect(readdirSync(empty).filter((f) => f.startsWith('.tinyzoo-init-'))).toEqual([])
    // nothing was made next to it, in its parent
    expect(readdirSync(dir).filter((f) => f.startsWith('.tinyzoo-init-'))).toEqual([])
    const after = statSync(empty)
    expect([after.ino, after.dev]).toEqual([before.ino, before.dev])
    // already in the folder: no `cd .`
    expect(out.steps).not.toMatch(/\bcd\b/)
    expect(out.steps).toMatch(/pnpm install/)
  })

  it('refuses a path that is a file', () => {
    const file = fresh()
    writeFileSync(file, 'x')
    expect(() => scaffold({ dest: file, starterDir, version: '1.0.0', ...resolveOptions() })).toThrow(/exists and is not a folder/)
    expect(readFileSync(file, 'utf8')).toBe('x')
  })

  it('removes only what it moved when moving into an existing folder fails halfway', () => {
    const empty = fresh()
    mkdirSync(empty)
    const before = statSync(empty)
    let moves = 0
    hook.rename = (from, to) => {
      if (to.startsWith(`${empty}/`) && from.startsWith(`${empty}/.tinyzoo-init-`) && ++moves === 3) {
        // a file the person (or another program) put there in the meantime is theirs
        writeFileSync(join(empty, 'theirs.txt'), 'keep')
        throw new Error('EBUSY: simulated')
      }
    }
    try { expect(() => scaffold({ dest: empty, starterDir, version: '1.0.0', ...resolveOptions() })).toThrow(/EBUSY/) }
    finally { hook.rename = undefined }
    expect(moves).toBe(3)
    expect(readdirSync(empty)).toEqual(['theirs.txt'])
    const after = statSync(empty)
    expect([after.ino, after.dev]).toEqual([before.ino, before.dev])
  })

  it('may be several folders deep', () => {
    const deep = join(fresh(), 'a/b/site')
    scaffold({ dest: deep, starterDir, version: '1.0.0', ...resolveOptions() })
    expect(existsSync(join(deep, 'cms.config.ts'))).toBe(true)
  })

  it('leaves nothing behind when the starter does not fit: no folder, no half-made one, no folders made on the way', () => {
    // a starter whose cms.config.ts no longer has the line init rewrites
    const broken = join(dir, 'broken-starter')
    cpSync(starterDir, broken, { recursive: true, filter: (s) => !/node_modules|\.nuxt|\.output/.test(s) })
    writeFileSync(join(broken, 'cms.config.ts'), read(broken, 'cms.config.ts').replace("defineLocales({ default: 'cs', locales: ['cs', 'en'] })", 'defineLocales(somethingElse)'))
    const outer = fresh()
    const dest = join(outer, 'a/b/site')
    expect(() => scaffold({ dest, starterDir: broken, version: '1.0.0', ...resolveOptions() })).toThrow(/drifted apart/)
    expect(existsSync(outer)).toBe(false)
    // an existing parent stays, but nothing is left in it
    mkdirSync(outer)
    expect(() => scaffold({ dest: join(outer, 'site'), starterDir: broken, version: '1.0.0', ...resolveOptions() })).toThrow(/drifted apart/)
    expect(readdirSync(outer)).toEqual([])
  })
})

describe('the app secret', () => {
  const example = readFileSync(join(starterDir, '.env.example'), 'utf8')

  it('a new site has a .env with a secret of its own, made from .env.example, readable by its owner only', () => {
    const site = make().dest
    const env = read(site, '.env')
    const secret = /^NUXT_APP_SECRET=(.*)$/m.exec(env)?.[1] ?? ''
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(secret).not.toBe(/^NUXT_APP_SECRET=(.*)$/m.exec(example)?.[1])
    // the rest is the example (the database address of its compose.yaml), nothing else changed
    expect(env.replace(secret, 'X')).toBe(applyMarkers(example, new Set([...PRESET_NAMES, 'demo']), '.env.example').replace(/^NUXT_APP_SECRET=.*$/m, 'NUXT_APP_SECRET=X'))
    expect(read(site, '.gitignore').split('\n')).toContain('.env')
    if (process.platform !== 'win32') expect(statSync(join(site, '.env')).mode & 0o077).toBe(0)
  })

  it('differs from site to site, and .env.example stays the documentation (with the example value)', () => {
    const [a, b] = [make().dest, make().dest]
    expect(/^NUXT_APP_SECRET=(.*)$/m.exec(read(a, '.env'))?.[1]).not.toBe(/^NUXT_APP_SECRET=(.*)$/m.exec(read(b, '.env'))?.[1])
    expect(read(a, '.env.example')).toContain('NUXT_APP_SECRET=change-me-to-a-long-random-string-32-chars-min')
    expect(newAppSecret()).not.toBe(newAppSecret())
  })

  it('is written when the site has only some parts too (the markers in .env.example still resolve)', () => {
    const site = make({ presets: [], demo: false, languages: ['de'] }).dest
    expect(read(site, '.env')).toMatch(/^NUXT_APP_SECRET=[A-Za-z0-9_-]{43}$/m)
    expect(read(site, '.env')).not.toContain('#if')
    expect(read(site, '.env')).not.toContain('NOTIFY_TO')
  })

  it('stops, and leaves nothing, when the starter has no NUXT_APP_SECRET line to fill', () => {
    const broken = join(dir, 'no-secret-starter')
    cpSync(starterDir, broken, { recursive: true, filter: (s) => !/node_modules|\.nuxt|\.output/.test(s) })
    writeFileSync(join(broken, '.env.example'), 'DATABASE_URL=x\n')
    const dest = fresh()
    expect(() => scaffold({ dest, starterDir: broken, version: '1.0.0', ...resolveOptions() })).toThrow(/NUXT_APP_SECRET/)
    expect(existsSync(dest)).toBe(false)
  })
})

describe('the next steps', () => {
  it('list what is still to do, in the package manager\'s commands', () => {
    const text = nextSteps({ folder: 'my-site', packageManager: 'npm', demo: true, regenerate: { schema: true, client: true } })
    expect(text).toMatch(/cd my-site\n\s+npm install\n\s+npm run db:generate.*\n\s+npm run cms:client.*\n\s+docker compose up -d/)
    // .env is made by init: nothing to copy, and it says so
    expect(text).not.toContain('cp .env.example')
    expect(text).toMatch(/\.env is made, with a NUXT_APP_SECRET of its own/)
    expect(text).toContain('npm run seed')
    const done = nextSteps({ folder: 'my-site', packageManager: 'pnpm', demo: false, regenerate: { schema: true, client: true }, installed: true, generated: true })
    expect(done).not.toMatch(/install|db:generate|cms:client|seed/)
    expect(done).toContain('pnpm db:migrate')
  })
})
