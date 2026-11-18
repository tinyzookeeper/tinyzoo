// `tinyzoo init`: a new website from the starter. Plain JavaScript on node's own modules, so
// it runs anywhere, without TypeScript, and `create-tinyzoo` bundles this very file (`pnpm
// create tinyzoo` asks its questions and then calls `scaffold`, so both paths make the same site).
//
// The starter (packages/cms/starter) is a working site with every optional part in it. Lines
// between `// #if <flag>` and `// #endif` (`<!-- #if <flag> -->` in templates and Markdown,
// `# #if <flag>` in .env files) belong to that flag and stay only when the site has it:
//
//   flags: news, forms, redirects, search (the presets), demo (the demo content)
//   `#if !demo` keeps the lines when the flag is off
//
// A few lines that depend on the languages are rewritten (`edit` below; each must be found
// exactly once, so a starter that drifts from this file fails the tests instead of a site).
import { randomBytes } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, normalize, resolve } from 'node:path'

/** A refusal the user can fix: bad flag, a folder that is not empty. The command prints its message. */
export class InitError extends Error {}

/** The optional parts of the site, each one a flag in the starter. */
export const PRESETS = [
  { name: 'news', label: 'News', hint: 'a news collection with a list and a page for each item' },
  { name: 'forms', label: 'Contact form', hint: 'the Forms plugin, a contact page block and the messages in the admin' },
  { name: 'redirects', label: 'Redirects', hint: 'old addresses that lead to new ones' },
  { name: 'search', label: 'Search', hint: 'a search page on the website' },
]
export const PRESET_NAMES = PRESETS.map((p) => p.name)

/** What a site gets without any flag: Czech first, then English, every part, the demo content. */
export const DEFAULT_LANGUAGES = ['cs', 'en']
/** The languages the demo content is written in. */
export const DEMO_LANGUAGES = ['cs', 'en']
export const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun']

/** Languages offered by name when asking; any code of two or three letters works. */
export const COMMON_LANGUAGES = ['cs', 'en', 'de', 'sk', 'pl', 'fr', 'es', 'it']
const LANGUAGE_CODE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/

/** The words the website uses in an address, per language (app/utils/site.ts has the same; a test compares them). */
export const ADDRESS_WORDS = {
  cs: { news: 'aktuality', search: 'hledat' },
  en: { news: 'news', search: 'search' },
  de: { news: 'neuigkeiten', search: 'suche' },
}
const wordsOf = (code) => ADDRESS_WORDS[code] ?? ADDRESS_WORDS.en

export const INIT_USAGE = [
  'usage: tinyzoo init <folder> [--languages cs,en] [--presets news,forms,redirects,search | none] [--demo | --no-demo] [--package-manager pnpm]',
  '',
  '  --languages   the content languages, the first one is the default (default: cs,en)',
  `  --presets     which parts the site has: ${PRESET_NAMES.join(', ')}, or none (default: all)`,
  '  --demo        the demo content (a small bakery); --no-demo makes an empty site (default: with demo content',
  '                when the first language is cs or en)',
  '  --package-manager  the commands to show and put in the README (default: the one that ran this)',
].join('\n')

/** Which package manager started us, from `npm_config_user_agent` (`pnpm/10.0.0 npm/? node/v22 …`). */
export function detectPackageManager(userAgent = process.env.npm_config_user_agent) {
  const name = /^(pnpm|npm|yarn|bun)\//.exec(userAgent ?? '')?.[1]
  return name ?? 'pnpm'
}

/** `cs, en , de` → ['cs', 'en', 'de']; refuses what is not a language code, a repeat, or nothing. */
export function parseLanguages(text) {
  const list = String(text).split(',').map((s) => s.trim()).filter(Boolean)
  if (!list.length) throw new InitError('--languages needs at least one language, e.g. --languages cs,en')
  for (const code of list) if (!LANGUAGE_CODE.test(code)) throw new InitError(`"${code}" is not a language code (use e.g. cs, en, de, pt-BR).`)
  if (new Set(list).size !== list.length) throw new InitError(`--languages lists a language twice: ${list.join(',')}`)
  return list
}

/** `news,forms` → those; `all` or `none` as they say. */
export function parsePresets(text) {
  const raw = String(text).trim().toLowerCase()
  if (raw === 'all') return [...PRESET_NAMES]
  if (raw === 'none') return []
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean)
  for (const name of list) {
    // (pages, settings, menus and SEO are in every site: not a choice)
    if (!PRESET_NAMES.includes(name)) throw new InitError(`Unknown preset "${name}". The presets are ${PRESET_NAMES.join(', ')} (or all, none).`)
  }
  return PRESET_NAMES.filter((n) => list.includes(n))
}

/**
 * The flags of `tinyzoo init` and `create-tinyzoo`, from `process.argv.slice(n)`. A flag that is not
 * given is `undefined`, so the caller knows what to ask. `create: true` is for `create-tinyzoo`,
 * which also takes `--install` / `--no-install` and `-y` / `--yes` (`tinyzoo init` never asks and
 * never installs, so it refuses them).
 * @param {string[]} argv
 * @param {{ create?: boolean }} [options]
 */
export function parseInitArgs(argv, options = {}) {
  const out = { folder: undefined, languages: undefined, presets: undefined, demo: undefined, yes: false, help: false, install: undefined, packageManager: undefined }
  const takesValue = new Set(['--languages', '--presets', '--package-manager'])
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') { out.help = true; continue }
    if (arg === '--demo') { out.demo = true; continue }
    if (arg === '--no-demo') { out.demo = false; continue }
    if (options.create && (arg === '-y' || arg === '--yes')) { out.yes = true; continue }
    if (options.create && arg === '--install') { out.install = true; continue }
    if (options.create && arg === '--no-install') { out.install = false; continue }
    if (arg.startsWith('-')) {
      const [flag, inline] = arg.split(/=(.*)/s)
      if (!takesValue.has(flag)) throw new InitError(`Unknown option ${flag}.`)
      const value = inline ?? argv[++i]
      if (value === undefined || value.startsWith('-')) throw new InitError(`${flag} needs a value.`)
      if (flag === '--languages') out.languages = parseLanguages(value)
      else if (flag === '--presets') out.presets = parsePresets(value)
      else {
        if (!PACKAGE_MANAGERS.includes(value)) throw new InitError(`Unknown package manager "${value}" (${PACKAGE_MANAGERS.join(', ')}).`)
        out.packageManager = value
      }
      continue
    }
    if (out.folder !== undefined) throw new InitError(`Only one folder, got "${out.folder}" and "${arg}".`)
    out.folder = arg
  }
  return out
}

/**
 * What was given, with the defaults filled in and checked together.
 * @param {{ languages?: string[], presets?: string[], demo?: boolean }} given
 */
export function resolveOptions(given = {}) {
  const languages = given.languages ?? [...DEFAULT_LANGUAGES]
  const presets = given.presets ?? [...PRESET_NAMES]
  const demoPossible = DEMO_LANGUAGES.includes(languages[0])
  if (given.demo === true && !demoPossible) {
    throw new InitError(`The demo content is in Czech and English, so cs or en has to be the first language (it is ${languages[0]}). Use --no-demo, or put cs or en first.`)
  }
  return { languages, presets, demo: given.demo ?? demoPossible }
}

// ── the markers ──

const FLAGS = new Set([...PRESET_NAMES, 'demo'])
const MARKER = /^\s*(?:\/\/|#|<!--|\/\*)\s*#(if|endif)(?:[ \t]+(!?[a-z]+))?\s*(?:-->|\*\/)?\s*$/

/**
 * Keeps the lines of the flags that are on and drops the markers. Blocks nest; `!flag` is
 * for what stays when a flag is off.
 * @param {string} text
 * @param {Set<string>} on  the flags that are on
 * @param {string} [where]  for the error message
 */
export function applyMarkers(text, on, where = 'text') {
  const out = []
  const parents = []
  let active = true
  let lineNo = 0
  for (const line of text.split('\n')) {
    lineNo++
    const m = MARKER.exec(line)
    if (!m) { if (active) out.push(line); continue }
    if (m[1] === 'endif') {
      if (!parents.length) throw new Error(`${where}:${lineNo}: #endif without #if`)
      active = parents.pop()
      continue
    }
    const raw = m[2]
    const flag = raw?.replace(/^!/, '')
    if (!flag || !FLAGS.has(flag)) throw new Error(`${where}:${lineNo}: unknown flag "${raw ?? ''}" (${[...FLAGS].join(', ')})`)
    parents.push(active)
    active = active && (on.has(flag) !== raw.startsWith('!'))
  }
  if (parents.length) throw new Error(`${where}: #if without #endif`)
  // (a dropped block can leave two empty lines in a row)
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

const TEXT_FILE = /\.(ts|vue|md|mjs|css)$|(^|\/)\.env\.example$/

function* files(dir, base = dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* files(path, base)
    else yield path
  }
}

// ── the languages ──

const quoteKey = (key) => (/^[a-z]+$/.test(key) ? key : `'${key}'`)
const englishName = (code) => {
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code }
  catch { return code }
}
/** An address in a language: the first language has no prefix (/aktuality), the others do (/en/news). */
const inLanguage = (languages, code, path) => (code === languages[0] ? path : `/${code}${path}`)

/**
 * The folder's name as an npm package name.
 * @param {string} folder
 */
export const packageNameOf = (folder) => basename(folder).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'my-site'

/**
 * `pnpm <script>` in the starter's README, in the commands of another package manager.
 * @param {string} text
 * @param {string} pm
 */
export function commandsFor(text, pm) {
  if (pm === 'pnpm') return text
  return text
    .replace(/\bpnpm (install)\b/g, `${pm} install`)
    .replace(/\bpnpm ([a-z][\w:-]*)((?: --[a-z-]+)*)/g, (_all, script, flags) => {
      if (pm === 'npm') return `npm run ${script}${flags ? ` --${flags}` : ''}`
      return `${pm === 'bun' ? 'bun run' : 'yarn'} ${script}${flags}`
    })
}

/** A command that runs one of the site's scripts, as the package manager writes it. */
export const runScript = (pm, script) => (pm === 'npm' ? `npm run ${script}` : pm === 'bun' ? `bun run ${script}` : `${pm} ${script}`)

/** The app secret the site's `.env` gets: 32 random bytes, 43 characters of base64url (no `+`, `/` or `=` to trip an env parser). */
export const newAppSecret = () => randomBytes(32).toString('base64url')

/**
 * Makes the site: the starter, with the parts the options leave out removed, the languages
 * written in, and the tinyzoo versions pinned. Built in a work folder and moved into place, so
 * nothing is left behind when it fails. A folder that does not exist yet is made by renaming the
 * work folder (made next to it); an existing empty folder (`tinyzoo init .`) is kept as it is, with
 * its owner, permissions and mount, and the finished files are moved into it (the work folder is
 * made inside it, so the move never crosses a file system).
 * @param {{ dest: string, starterDir: string, version: string, languages: string[], presets: string[], demo: boolean, packageManager?: string }} options
 * @returns {{ dest: string, regenerate: { schema: boolean, client: boolean } }}
 *   `regenerate`: what the site must generate before it starts, because the starter's own copy
 *   does not fit (the database schema and migration for other presets, the typed client for other presets or languages)
 */
export function scaffold({ dest, starterDir, version, languages, presets, demo, packageManager = 'pnpm' }) {
  dest = resolve(dest)
  const existing = existsSync(dest)
  if (existing) {
    if (!statSync(dest).isDirectory()) throw new InitError(`${dest} exists and is not a folder`)
    if (readdirSync(dest).length) throw new InitError(`${dest} exists and is not empty`)
  }
  resolveOptions({ languages, presets, demo })
  if (!existsSync(starterDir)) throw new Error(`the starter is missing: ${starterDir}`)

  // A folder made on the way (foo/bar/site makes foo and foo/bar) goes with a failure too.
  const firstMade = existing ? undefined : mkdirSync(dirname(dest), { recursive: true })
  const work = mkdtempSync(join(existing ? dest : dirname(dest), '.tinyzoo-init-'))
  const moved = []
  try {
    const skip = new Set(['node_modules', '.nuxt', '.output', '.env', '.cms-uploads', '.cms-mail', '.data'])
    cpSync(starterDir, work, { recursive: true, filter: (src) => !skip.has(basename(src)) })
    renameSync(join(work, 'gitignore.txt'), join(work, '.gitignore'))
    const result = shape(work, { starterDir, version, languages, presets, demo, packageManager, folder: dest })
    if (existing) {
      for (const name of readdirSync(work)) {
        renameSync(join(work, name), join(dest, name))
        moved.push(name)
      }
      rmSync(work, { recursive: true })
    }
    else renameSync(work, dest)
    return { dest, ...result }
  }
  catch (err) {
    // Only what this run put there: the moved files, the work folder, the folders made on the way.
    for (const name of moved) rmSync(join(dest, name), { recursive: true, force: true })
    rmSync(work, { recursive: true, force: true })
    if (firstMade) rmSync(firstMade, { recursive: true, force: true })
    throw err
  }
}

/** The starter copied into `root`, made into this site. */
function shape(root, { version, languages, presets, demo, packageManager, folder }) {
  const read = (p) => readFileSync(join(root, p), 'utf8')
  const write = (p, text) => writeFileSync(join(root, p), text)
  const edit = (p, from, to) => {
    const text = read(p)
    if (text.split(from).length !== 2) throw new Error(`tinyzoo init: expected exactly one "${from}" in ${p}: the starter and cli/init.mjs have drifted apart`)
    write(p, text.replace(from, () => to))
  }
  const has = (preset) => presets.includes(preset)
  const first = languages[0]

  // What the site does not have goes first, so the edits below only meet what is left.
  if (!demo) rmSync(join(root, 'seed'), { recursive: true })
  if (!has('forms')) rmSync(join(root, 'app/components/global/BlockContact.vue'))
  if (!has('search')) rmSync(join(root, 'app/pages/search.vue'))

  const on = new Set([...presets, ...(demo ? ['demo'] : [])])
  for (const path of files(root)) {
    const rel = path.slice(root.length + 1).split('\\').join('/')
    if (!TEXT_FILE.test(rel)) continue
    const text = readFileSync(path, 'utf8')
    if (!/#(if|endif)\b/.test(text)) continue
    writeFileSync(path, applyMarkers(text, on, rel))
  }

  // The languages (cms.config.ts has them, the website's app/utils/site.ts too).
  edit('cms.config.ts', "defineLocales({ default: 'cs', locales: ['cs', 'en'] })", `defineLocales({ default: '${first}', locales: [${languages.map((l) => `'${l}'`).join(', ')}] })`)
  edit('cms.config.ts', '// Czech first; English is a translation of the fields marked .localized().',
    languages.length === 1
      ? `// ${englishName(first)} only. To add a language, put its code here and in app/utils/site.ts, then run \`pnpm cms:client\`.`
      : `// ${englishName(first)} first; ${languages.slice(1).map(englishName).join(', ')} ${languages.length > 2 ? 'are translations' : 'is a translation'} of the fields marked .localized().`)
  edit('app/utils/site.ts', "export const LANGUAGES: string[] = ['cs', 'en']", `export const LANGUAGES: string[] = [${languages.map((l) => `'${l}'`).join(', ')}]`)
  // The admin's own language (cs and en only) follows the site's first one.
  if (first !== 'cs') edit('app/app.config.ts', "defaultLocale: 'cs',", `defaultLocale: '${first === 'en' || !DEMO_LANGUAGES.includes(first) ? 'en' : first}',`)

  if (has('news')) {
    edit('cms.config.ts', "const newsAddress = { cs: '/aktuality/:slug', en: '/news/:slug' }",
      `const newsAddress = { ${languages.map((l) => `${quoteKey(l)}: '/${wordsOf(l).news}/:slug'`).join(', ')} }`)
    edit('nuxt.config.ts', "paths: [{ cs: '/aktuality', en: '/en/news' }]",
      `paths: [{ ${languages.map((l) => `${quoteKey(l)}: '${inLanguage(languages, l, `/${wordsOf(l).news}`)}'`).join(', ')} }]`)
  }
  if (has('search')) {
    const alias = languages.slice(1).map((l) => `'${inLanguage(languages, l, `/${wordsOf(l).search}`)}'`)
    edit('app/pages/search.vue', "definePageMeta({ name: 'search', path: '/hledat', alias: ['/en/search'] })",
      `definePageMeta({ name: 'search', path: '/${wordsOf(first).search}'${alias.length ? `, alias: [${alias.join(', ')}]` : ''} })`)
    edit('app/pages/search.vue', '// Search the website: /hledat (and /en/search).', `// Search the website: /${wordsOf(first).search}${alias.length ? ` (and ${alias.map((a) => a.slice(1, -1)).join(', ')})` : ''}.`)
  }

  // package.json: the site's name, the released versions instead of workspace links, no seed script without a seed.
  const pkg = JSON.parse(read('package.json'))
  pkg.name = packageNameOf(folder)
  for (const deps of [pkg.dependencies, pkg.devDependencies]) {
    for (const [name, v] of Object.entries(deps ?? {})) if (String(v).startsWith('workspace:')) deps[name] = `^${version}`
  }
  if (!demo) delete pkg.scripts.seed
  write('package.json', JSON.stringify(pkg, null, 2) + '\n')
  write('README.md', commandsFor(read('README.md'), packageManager))

  // .env: the example with a secret of its own. A copy of .env.example would carry the example
  // secret, which anybody can read in the repository (the start check refuses it in production).
  if (!existsSync(join(root, '.env'))) {
    const example = read('.env.example')
    if (example.match(/^NUXT_APP_SECRET=.*$/gm)?.length !== 1) throw new Error('tinyzoo init: expected exactly one NUXT_APP_SECRET= line in .env.example: the starter and cli/init.mjs have drifted apart')
    // (mode 0600: the file holds a secret; renaming it into place keeps that)
    writeFileSync(join(root, '.env'), example.replace(/^NUXT_APP_SECRET=.*$/m, () => `NUXT_APP_SECRET=${newAppSecret()}`), { mode: 0o600 })
  }
  edit('README.md', 'cp .env.example .env        # your settings, and a NUXT_APP_SECRET of your own (openssl rand -base64 32)\n', '')

  // The generated files that come with the starter fit its own cms.config.ts: the full set of
  // parts in cs and en. Anything else regenerates them (`db:generate`, `cms:client`).
  const allParts = PRESET_NAMES.every(has)
  const sameLanguages = languages.join() === DEFAULT_LANGUAGES.join()
  const regenerate = { schema: !allParts, client: !allParts || !sameLanguages }
  if (regenerate.schema) {
    rmSync(join(root, 'server/db/schema.ts'))
    rmSync(join(root, 'server/db/migrations'), { recursive: true })
  }
  if (regenerate.client) rmSync(join(root, 'app/lib/cms-content.ts'))
  return { regenerate }
}

/**
 * What to do next, as a text for the terminal.
 * @param {{ folder: string, packageManager: string, demo: boolean, regenerate: { schema: boolean, client: boolean }, installed?: boolean, generated?: boolean }} o
 *   `installed`: the dependencies are in already; `generated`: so are the schema and the client
 */
export function nextSteps({ folder, packageManager: pm, demo, regenerate, installed = false, generated = false }) {
  const run = (script) => runScript(pm, script)
  // (`tinyzoo init .` is already in the folder)
  const lines = normalize(folder).replace(/[\\/]$/, '') === '.' ? [] : [`cd ${/[\s'"$`\\]/.test(folder) ? `'${folder.replace(/'/g, `'\\''`)}'` : folder}`]
  if (!installed) lines.push(`${pm} install`)
  if (!generated && regenerate.schema) lines.push(`${run('db:generate')}      # the first migration, from your cms.config.ts`)
  if (!generated && regenerate.client) lines.push(`${run('cms:client')}      # the typed client for the pages`)
  lines.push('docker compose up -d', run('db:migrate'), `${run('dev')}   → http://localhost:3000/admin`)
  let text = `\n  ${lines.join('\n  ')}\n\n  .env is made, with a NUXT_APP_SECRET of its own for this machine. A server needs its own: openssl rand -base64 32\n`
  if (demo) {
    text += `\n  Demo content, while \`${run('dev')}\` runs in another terminal:\n  SEED_EMAIL=you@example.com SEED_PASSWORD='a long password' ${run('seed')}\n  (creates the first administrator with those details; run it again any time, it changes nothing twice)\n`
  }
  return text
}
