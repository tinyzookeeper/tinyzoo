import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, relative } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ADDRESS_WORDS, applyMarkers, commandsFor, detectPackageManager, InitError, nextSteps, PRESET_NAMES, packageNameOf,
  parseInitArgs, parseLanguages, parsePresets, resolveOptions, scaffold,
} from '../../packages/cms/cli/init.mjs'
import { WORDS } from '../../packages/cms/starter/app/utils/site'

// `tinyzoo init` and `create-tinyzoo`: the options, the markers in the starter and the sites made from it.
// The sites are checked in full (installed, built, started) by `pnpm check:starter`; here, what is cheap to see.

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
    const args = parseInitArgs(['my-site', '--languages', 'cs, en,de', '--presets=news,search', '--no-demo', '--package-manager', 'npm', '-y'])
    expect(args).toMatchObject({ folder: 'my-site', languages: ['cs', 'en', 'de'], presets: ['news', 'search'], demo: false, packageManager: 'npm', yes: true, install: undefined })
    expect(parseInitArgs(['--demo', 'x']).demo).toBe(true)
    expect(parseInitArgs([]).folder).toBeUndefined()
  })

  it('takes --install only where the command installs', () => {
    expect(parseInitArgs(['a', '--install'], { install: true }).install).toBe(true)
    expect(parseInitArgs(['a', '--no-install'], { install: true }).install).toBe(false)
    expect(() => parseInitArgs(['a', '--install'])).toThrow(InitError)
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
    else expect(read(site, 'nuxt.config.ts')).not.toContain('sitemap')
    if (has('search')) {
      const search = read(site, 'app/pages/search.vue')
      const word = (l: string) => (ADDRESS_WORDS as Record<string, { search: string }>)[l]?.search ?? 'search'
      expect(search).toContain(`path: '/${word(languages[0]!)}'`)
      expect(search.includes('alias')).toBe(languages.length > 1)
    }
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
      if (/\.(ts|vue|md|mjs|css)$|\.env\.example$/.test(rel)) expect(b.toString(), rel).toBe(applyMarkers(a.toString(), on, rel))
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

  it('may be an empty folder that exists, and may be several folders deep', () => {
    const empty = fresh()
    mkdirSync(empty)
    scaffold({ dest: empty, starterDir, version: '1.0.0', ...resolveOptions() })
    expect(existsSync(join(empty, 'cms.config.ts'))).toBe(true)
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

describe('the next steps', () => {
  it('list what is still to do, in the package manager\'s commands', () => {
    const text = nextSteps({ folder: 'my-site', packageManager: 'npm', demo: true, regenerate: { schema: true, client: true } })
    expect(text).toMatch(/cd my-site\n\s+npm install\n\s+npm run db:generate.*\n\s+npm run cms:client.*\n\s+cp \.env\.example \.env/)
    expect(text).toContain('npm run seed')
    const done = nextSteps({ folder: 'my-site', packageManager: 'pnpm', demo: false, regenerate: { schema: true, client: true }, installed: true, generated: true })
    expect(done).not.toMatch(/install|db:generate|cms:client|seed/)
    expect(done).toContain('pnpm db:migrate')
  })
})
