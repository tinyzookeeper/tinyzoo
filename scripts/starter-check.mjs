// The starter as a new site gets it, in four combinations of languages, parts and demo content.
// Every site is made by the PACKED package (`tinyzoo init`, or `create-tinyzoo` for one of them),
// installed from the tarballs (no workspace links), has its generated files written where the
// choices call for it (`db:generate`, `cms:client`), is migrated, type-checked, built and started,
// and then checked for what it should and should not have:
//
//   defaults            `tinyzoo init`, no options: Czech and English, every part, the demo content.
//                       The deep check: the demo content arrives once (a second seed changes nothing),
//                       the pages, the head, the sitemap, the menus follow renamed pages, `seed --reset`,
//                       and only `.output` ships.
//   english, empty      one language, no demo content, no parts but pages: an empty site that says so
//   all, with German    `create-tinyzoo --yes` with cs,en,de and every part: German has its own words and addresses
//   english first       en,cs with news and redirects only: the demo content written English first
//
//   STARTER_CHECK_DATABASE_URL=postgres://cms:cms@localhost:5434/cms_test_starter node scripts/starter-check.mjs
//   node scripts/starter-check.mjs --only defaults     (one combination; names above, or the first word)
//
// The databases are created for the run and dropped at the end; the name must not be one of
// a real site's (it has to contain "scratch" or "test"); each combination adds a suffix to it.
// Without the variable the name is derived from TEST_DATABASE_URL (`<name>_starter`).
// KEEP_STARTER=1 keeps the folders.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'

const root = join(import.meta.dirname, '..')

function databaseUrl() {
  if (process.env.STARTER_CHECK_DATABASE_URL) return process.env.STARTER_CHECK_DATABASE_URL
  if (process.env.TEST_DATABASE_URL) {
    const u = new URL(process.env.TEST_DATABASE_URL)
    u.pathname = `${u.pathname}_starter`
    return u.toString()
  }
  throw new Error('Set STARTER_CHECK_DATABASE_URL (or TEST_DATABASE_URL) to a scratch database on a development Postgres.')
}
const baseUrl = databaseUrl()
const baseName = new URL(baseUrl).pathname.slice(1)
if (!/^[a-z0-9_]+$/.test(baseName) || !/(scratch|test)/.test(baseName)) throw new Error(`Refusing database "${baseName}": the name must contain "scratch" or "test".`)
const urlOf = (name) => { const u = new URL(baseUrl); u.pathname = `/${name}`; return u.toString() }
const adminUrl = urlOf('postgres')

const work = mkdtempSync(join(tmpdir(), 'cms-starter-'))
const packs = join(work, 'packs')
const run = (cmd, args, cwd, env = {}) => execFileSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } })
const fail = (message) => { throw new Error(message) }
const ok = (cond, message) => { if (!cond) fail(message) }

const withAdmin = async (fn) => {
  const c = new pg.Client({ connectionString: adminUrl })
  await c.connect()
  try { return await fn(c) } finally { await c.end() }
}
const freePort = () => new Promise((resolve, reject) => {
  const srv = createServer()
  srv.unref()
  srv.on('error', reject)
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)) })
})

const ALL_PARTS = ['news', 'forms', 'redirects', 'search', 'analytics']
const SCENARIOS = [
  { id: 'defaults', via: 'init', args: [], languages: ['cs', 'en'], presets: ALL_PARTS, demo: true, deep: true },
  { id: 'english-empty', via: 'init', args: ['--languages', 'en', '--no-demo', '--presets', 'none'], languages: ['en'], presets: [], demo: false },
  { id: 'all-with-german', via: 'create', args: ['--languages', 'cs,en,de', '--presets', ALL_PARTS.join(',')], languages: ['cs', 'en', 'de'], presets: ALL_PARTS, demo: true },
  { id: 'english-first', via: 'init', args: ['--languages', 'en,cs', '--presets', 'news,redirects'], languages: ['en', 'cs'], presets: ['news', 'redirects'], demo: true },
]
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : process.env.STARTER_CHECK_ONLY
const chosen = SCENARIOS.filter((sc) => !only || sc.id === only || sc.id.startsWith(only))
ok(chosen.length, `no combination called "${only}" (${SCENARIOS.map((s) => s.id).join(', ')})`)

/** Every text file of a site (not what an install or a build made). */
function* textFiles(dir, base = dir) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.nuxt', '.output', '.data', '.cms-uploads', 'media'].includes(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* textFiles(path, base)
    else if (/\.(ts|vue|md|mjs|css|json|sql|example|txt)$/.test(name)) yield path
  }
}

/** The site made, with what a combination should have and should not have. */
function checkTheSite({ site, sc, stdout }) {
  const has = (path) => existsSync(join(site, path))
  const wantPart = (part) => sc.presets.includes(part)
  const regenerate = { schema: sc.presets.length !== ALL_PARTS.length, client: sc.presets.length !== ALL_PARTS.length || sc.languages.join() !== 'cs,en' }
  for (const file of textFiles(site)) {
    ok(!/^\s*(?:\/\/|#|<!--|\/\*)\s*#(?:if|endif)\b/m.test(readFileSync(file, 'utf8')), `${file.slice(site.length + 1)} still has an #if marker`)
  }
  ok(has('seed/index.ts') === sc.demo && has('seed/media/hero.jpg') === sc.demo, `seed/ should ${sc.demo ? '' : 'not '}be there`)
  ok(has('app/pages/search.vue') === wantPart('search'), `the search page should ${wantPart('search') ? '' : 'not '}be there`)
  ok(has('app/components/global/BlockContact.vue') === wantPart('forms'), `the contact block should ${wantPart('forms') ? '' : 'not '}be there`)
  ok(has('server/db/schema.ts') === !regenerate.schema && has('server/db/migrations/0000_init.sql') === !regenerate.schema, `the starter's schema and migrations should ${regenerate.schema ? 'not ' : ''}ship with this site`)
  ok(has('app/lib/cms-content.ts') === !regenerate.client, `the starter's typed client should ${regenerate.client ? 'not ' : ''}ship with this site`)
  const config = readFileSync(join(site, 'cms.config.ts'), 'utf8')
  ok(config.includes(`defineLocales({ default: '${sc.languages[0]}', locales: [${sc.languages.map((l) => `'${l}'`).join(', ')}] })`), `cms.config.ts has other languages than ${sc.languages}`)
  for (const [part, needle] of [['news', "defineEntity('news'"], ['forms', 'formsPlugin()'], ['redirects', 'defineRedirects()'], ['analytics', 'analyticsPlugin()']]) {
    ok(config.includes(needle) === wantPart(part), `cms.config.ts should ${wantPart(part) ? '' : 'not '}have ${part}`)
  }
  const pkg = JSON.parse(readFileSync(join(site, 'package.json'), 'utf8'))
  ok(!!pkg.scripts.seed === sc.demo, `package.json should ${sc.demo ? '' : 'not '}have a seed script`)
  // .env comes with a secret of its own, not the example's (a production server refuses that one)
  const secret = /^NUXT_APP_SECRET=(.+)$/m.exec(existsSync(join(site, '.env')) ? readFileSync(join(site, '.env'), 'utf8') : '')?.[1]
  const example = /^NUXT_APP_SECRET=(.+)$/m.exec(readFileSync(join(site, '.env.example'), 'utf8'))?.[1]
  ok(!!secret && secret.length >= 32 && secret !== example, `the site's .env should have a NUXT_APP_SECRET of its own (got ${secret ? 'the example or a short one' : 'none'})`)
  ok(/^\.env$/m.test(readFileSync(join(site, '.gitignore'), 'utf8')), 'the site\'s .gitignore should list .env')
  ok(!/cp \.env\.example/.test(stdout), 'the next steps should not tell people to copy .env.example over the .env that was made')
  ok(/db:generate/.test(stdout) === regenerate.schema && /cms:client/.test(stdout) === regenerate.client, `the next steps should${regenerate.schema ? '' : ' not'} say db:generate and${regenerate.client ? '' : ' not'} cms:client:\n${stdout}`)
  ok(/pnpm seed/.test(stdout) === sc.demo, `the next steps should${sc.demo ? '' : ' not'} mention \`pnpm seed\``)
  return regenerate
}

async function checkScenario(sc, tarballs) {
  const dir = join(work, sc.id)
  const site = join(dir, 'site')
  const uploads = join(dir, 'uploads')
  mkdirSync(dir)
  const dbName = sc.id === 'defaults' ? baseName : `${baseName}_${sc.id.replace(/[^a-z0-9]+/g, '_')}`
  const dbUrl = urlOf(dbName)
  const query = async (text) => {
    const c = new pg.Client({ connectionString: dbUrl })
    await c.connect()
    try { return (await c.query(text)).rows } finally { await c.end() }
  }
  const logs = []
  let server = null
  let dbCreated = false
  console.log(`\n━━ ${sc.id}: ${sc.via === 'create' ? 'create-tinyzoo' : 'tinyzoo init'} ${sc.args.join(' ')} ━━`)
  try {
    // The site, made by the packed package.
    const made = sc.via === 'create'
      ? spawnSync(process.execPath, [join(tarballs.create, 'bin/create-tinyzoo.mjs'), site, ...sc.args, '--yes'], { cwd: dir, encoding: 'utf8', env: { ...process.env, npm_config_user_agent: 'pnpm/10.0.0 npm/? node/v22' } })
      : spawnSync(join(root, 'packages/cms/node_modules/.bin/tsx'), [join(tarballs.cms, 'cli/index.ts'), 'init', site, ...sc.args], { cwd: dir, encoding: 'utf8' })
    process.stdout.write(made.stdout)
    process.stderr.write(made.stderr)
    ok(made.status === 0, `${sc.via === 'create' ? 'create-tinyzoo' : 'tinyzoo init'} failed`)
    const regenerate = checkTheSite({ site, sc, stdout: made.stdout })

    // Tarballs instead of version ranges, and one copy of the editor stack (as in the workspace).
    const pkgPath = join(site, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    // The init writes the package's own version as the range (a released 0.2.0 writes ^0.2.0).
    const packed = JSON.parse(readFileSync(join(root, 'packages/cms/package.json'), 'utf8')).version
    ok(pkg.dependencies.tinyzoo === `^${packed}` && pkg.dependencies['@tinyzoo/client'] === `^${packed}`, `the init should write ^${packed} for tinyzoo and @tinyzoo/client, got ${pkg.dependencies.tinyzoo} and ${pkg.dependencies['@tinyzoo/client']}`)
    pkg.dependencies.tinyzoo = `file:${tarballs.files.cms}`
    pkg.dependencies['@tinyzoo/client'] = `file:${tarballs.files.client}`
    pkg.pnpm = { overrides: { '@tiptap/core': '3.34.0', '@tiptap/pm': '3.34.0', 'prosemirror-model': '^1.25.13', 'prosemirror-state': '^1.4.4', 'prosemirror-view': '^1.41.0' } }
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
    run('pnpm', ['install', '--ignore-workspace', '--no-frozen-lockfile'], site)

    // What the starter's own generated files do not cover (other parts: the schema and its first
    // migration; other parts or languages: the typed client), the site writes itself.
    if (regenerate.schema) {
      run('pnpm', ['db:generate'], site)
      ok(readdirSync(join(site, 'server/db/migrations')).some((f) => /^0000_.*\.sql$/.test(f)), 'db:generate wrote no first migration')
    }
    if (regenerate.client) run('pnpm', ['cms:client'], site)

    // A database of its own, migrated by the starter's own script.
    await withAdmin(async (c) => {
      await c.query(`drop database if exists "${dbName}" with (force)`)
      await c.query(`create database "${dbName}"`)
    })
    dbCreated = true
    const env = { DATABASE_URL: dbUrl, NUXT_APP_SECRET: 'starter-check-app-secret-of-32-characters', NUXT_CMS_STORAGE_LOCAL_DIR: uploads, NUXT_CMS_MAIL_TRANSPORT: 'log' }
    run('pnpm', ['db:migrate'], site, env)

    // The site's own files type-check as shipped, templates included (the blocks are typed from the generated client).
    run('pnpm', ['typecheck'], site, env)

    run('pnpm', ['exec', 'nuxi', 'build'], site, { ...env, NODE_ENV: 'production' })
    const port = await freePort()
    const base = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, [join(site, '.output/server/index.mjs')], {
      cwd: site, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), NUXT_CMS_PUBLIC_URL: base, NUXT_CMS_AUTH_SETUP_TOKEN: undefined },
    })
    server.stdout.on('data', (d) => logs.push(String(d)))
    server.stderr.on('data', (d) => logs.push(String(d)))
    for (let i = 0; ; i++) {
      if (server.exitCode !== null) fail(`the site exited with ${server.exitCode}:\n${logs.join('')}`)
      try { if ((await fetch(`${base}/api/health/ready`)).ok) break } catch { /* not up yet */ }
      if (i > 200) fail(`the site did not start:\n${logs.join('')}`)
      await new Promise((r) => setTimeout(r, 250))
    }
    // The setup code is printed by a server plugin after the server is up, so "ready" can come first: wait for it (up to 5 s).
    let setupCode
    for (let i = 0; i < 20 && !setupCode; i++) {
      setupCode = /Setup code: ([A-Z0-9]{4}(?:-[A-Z0-9]{4}){3})/.exec(logs.join(''))?.[1]
      if (!setupCode) await new Promise((r) => setTimeout(r, 250))
    }
    ok(setupCode, 'the site did not print a setup code (a new production site must)')

    const get = async (path, init) => { const res = await fetch(base + path, { redirect: 'manual', ...init }); return { res, text: await res.text() } }
    const json = async (path) => JSON.parse((await get(path)).text)
    const seedEnv = { SEED_URL: base, SEED_EMAIL: 'starter@example.com', SEED_PASSWORD: 'correct horse battery', SEED_SETUP_CODE: setupCode }
    const seedRun = () => spawnSync('pnpm', ['seed'], { cwd: site, encoding: 'utf8', env: { ...process.env, ...seedEnv } })
    const ctx = { sc, site, base, dbName, dbUrl, env, work, query, get, json, seedEnv, seedRun, setupCode }

    if (sc.deep) await deepChecks(ctx)
    else await lightChecks(ctx)
    console.log(`✓ ${sc.id}`)
  }
  finally {
    if (server && server.exitCode === null) { server.kill('SIGTERM'); await new Promise((r) => server.once('exit', r)) }
    if (dbCreated) await withAdmin((c) => c.query(`drop database if exists "${dbName}" with (force)`)).catch((e) => console.error('could not drop', dbName, e.message))
  }
}

/** The other combinations: what they serve, and that a second seed changes nothing. */
async function lightChecks({ sc, base, query, get, json, seedRun }) {
  const lang = sc.languages[0]
  const [firstHome] = lang === 'cs' ? ['Chléb, který voní po ránu'] : ['Bread that smells like morning']
  const wants = (part) => sc.presets.includes(part)

  if (!sc.demo) {
    // An empty site: it says so, in its language, and serves nothing it does not have.
    const home = await get('/')
    ok(home.res.status === 200 && home.text.includes('The website is ready.'), `an empty English site should say it is ready: ${home.res.status}`)
    ok((await json('/api/content/page')).total === 0, 'an empty site has pages')
    ok((await get('/hledat')).res.status === 404 && (await get('/search')).res.status === 404, 'a site without search has a search page')
    ok((await get('/api/content/news')).res.status === 404, 'a site without news has a news API')
    ok((await get('/sitemap.xml')).res.status === 200 && (await get('/robots.txt')).text.includes('Disallow: /admin'), 'sitemap.xml or robots.txt is missing')
    ok(!(await get('/')).text.includes('hreflang="cs"'), 'a one-language site lists a second language')
    return
  }

  const first = seedRun()
  process.stdout.write(first.stdout)
  ok(first.status === 0 && /created the first administrator/.test(first.stdout), `the first seed failed:\n${first.stdout}${first.stderr}`)
  const count = async (table) => (await query(`select count(*)::int as n from ${table}`))[0].n
  ok(await count('page') === 3, 'the seed should make three pages')
  ok(wants('news') ? await count('news') === 4 : (await query(`select to_regclass('public.news') as t`))[0].t === null, 'the news are there, or not, as asked')
  ok(wants('redirects') ? await count('redirect') === 1 : (await query(`select to_regclass('public.redirect') as t`))[0].t === null, 'the redirect is there, or not, as asked')
  ok(wants('forms') ? await count('form_settings') === 1 : (await query(`select to_regclass('public.contact_form') as t`))[0].t === null, 'the form is there, or not, as asked')
  ok(((await query(`select to_regclass('public.analytics_events') as t`))[0].t !== null) === wants('analytics'), 'the analytics tables are there, or not, as asked')
  const second = seedRun()
  ok(second.status === 0 && !/✓ (created|updated|uploaded)/.test(second.stdout), `the second seed changed something:\n${second.stdout}${second.stderr}`)

  const homeOf = async (l) => (await json(`/api/content/page/home?locale=${l}`)).item
  const heroOf = (item) => item.sections[0].heading
  ok(heroOf(await homeOf('cs')) === 'Chléb, který voní po ránu.' && heroOf(await homeOf('en')) === 'Bread that smells like morning.', 'the home page is not in both languages')
  const home = await get('/')
  ok(home.res.status === 200 && home.text.includes(firstHome), `/ should say "${firstHome}"`)
  for (const l of sc.languages.slice(1)) {
    const res = await get(`/${l}`)
    ok(res.res.status === 200, `/${l}: ${res.res.status}`)
    ok(res.text.includes(`hreflang="${l}"`), `the head has no hreflang for ${l}`)
    if (l === 'cs') ok(res.text.includes('Chléb, který voní po ránu'), '/cs should be Czech')
    if (l === 'en') ok(res.text.includes('Bread that smells like morning'), '/en should be English')
  }
  // the language switcher offers every language, each in its own name
  const names = { cs: 'Čeština', en: 'English', de: 'Deutsch' }
  for (const l of sc.languages) ok(home.text.includes(names[l]), `the switcher has no ${names[l]}`)

  // the site's own words and addresses, per language
  const words = { cs: { news: 'Aktuality', newsPath: 'aktuality', search: 'Hledání', searchPath: 'hledat' }, en: { news: 'News', newsPath: 'news', search: 'Search', searchPath: 'search' }, de: { news: 'Neuigkeiten', newsPath: 'neuigkeiten', search: 'Suche', searchPath: 'suche' } }
  const at = (l, path) => (l === lang ? path : `/${l}${path}`)
  for (const l of sc.languages) {
    if (wants('news')) {
      const list = await get(at(l, `/${words[l].newsPath}`))
      ok(list.res.status === 200 && list.text.includes(`>${words[l].news}</h1>`), `${at(l, `/${words[l].newsPath}`)}: ${list.res.status}, the news list should be headed ${words[l].news}`)
    }
    else ok((await get(at(l, `/${words[l].newsPath}`))).res.status === 404, 'a site without news has a news list')
    if (wants('search')) {
      const page = await get(at(l, `/${words[l].searchPath}`))
      ok(page.res.status === 200 && page.text.includes(`>${words[l].search}</h1>`), `${at(l, `/${words[l].searchPath}`)}: ${page.res.status}, the search page should be headed ${words[l].search}`)
    }
    else ok((await get(at(l, `/${words[l].searchPath}`))).res.status === 404, 'a site without search has a search page')
  }
  if (wants('news')) {
    // a news item in the first language, with its address
    const cover = (await json(`/api/content/news?locale=${lang}`)).items[0]
    ok((await get(`${at(lang, `/${words[lang].newsPath}`)}/${cover.slug}`)).res.status === 200, 'a news item is not served')
  }
  // the contact page: a form only when the site has the Forms part
  const contactPath = lang === 'cs' ? '/kontakt' : '/contact'
  const contact = await get(contactPath)
  ok(contact.res.status === 200 && (contact.text.includes('name="email"') === wants('forms')), `${contactPath} should ${wants('forms') ? '' : 'not '}have the contact form`)
  // the sitemap lists the home page of every language that has content, as the website serves it (/, /en)
  const locs = [...(await get('/sitemap.xml')).text.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].replace(base, ''))
  for (const l of sc.languages.filter((x) => x === 'cs' || x === 'en')) ok(locs.includes(l === lang ? '/' : `/${l}`), `the sitemap misses the home page in ${l}: ${locs}`)
  ok(!locs.some((x) => /\/home$/.test(x)), `the sitemap lists a /home address: ${locs}`)
  // the search page says noindex, so the sitemap leaves it out in every language
  const searchPaths = sc.languages.map((l) => at(l, `/${words[l].searchPath}`))
  ok(!locs.some((x) => searchPaths.includes(x)), `the sitemap lists the search page: ${locs}`)
  if (wants('redirects')) {
    const from = lang === 'cs' ? '/pekarna' : '/bakery'
    const moved = await get(from)
    ok(moved.res.status === 301 && moved.res.headers.get('location') === (lang === 'cs' ? '/o-nas' : '/about'), `${from} should send visitors to the about page, got ${moved.res.status} ${moved.res.headers.get('location')}`)
  }
}

/** The defaults: the demo content in cs and en, checked in depth. */
async function deepChecks({ base, dbName, dbUrl, env, work, query, get, json, seedEnv, seedRun, site, setupCode }) {
  // ── seed twice ──
  const first = seedRun()
  process.stdout.write(first.stdout)
  ok(first.status === 0, `the first seed failed:\n${first.stdout}${first.stderr}`)
  ok(/created the first administrator/.test(first.stdout) && /Seeded .*created/.test(first.stdout), 'the first seed did not create anything')
  const snapshot = async () => ({
    page: (await query('select count(*)::int as n from page'))[0].n,
    news: (await query('select count(*)::int as n from news'))[0].n,
    media: (await query('select count(*)::int as n from cms_media'))[0].n,
    redirect: (await query('select count(*)::int as n from redirect'))[0].n,
    revisions: (await query('select count(*)::int as n from cms_revisions'))[0].n,
    audit: (await query(`select count(*)::int as n from cms_audit where action <> 'auth.login'`))[0].n,
    updated: (await query(`select md5(string_agg(id::text || updated_at::text, ',' order by id)) as h from (select id, updated_at from page union all select id, updated_at from news) x`))[0].h,
  })
  const afterFirst = await snapshot()
  console.log('after the first run:', afterFirst)
  ok(afterFirst.page === 3 && afterFirst.news === 4 && afterFirst.media === 5 && afterFirst.redirect === 1, `unexpected content after the first run: ${JSON.stringify(afterFirst)}`)

  const second = seedRun()
  process.stdout.write(second.stdout)
  ok(second.status === 0, `the second seed failed:\n${second.stdout}${second.stderr}`)
  ok(!/✓ (created|updated|uploaded)/.test(second.stdout), `the second seed changed something:\n${second.stdout}`)
  const afterSecond = await snapshot()
  ok(JSON.stringify(afterSecond) === JSON.stringify(afterFirst), `the second seed changed the database: ${JSON.stringify(afterFirst)} → ${JSON.stringify(afterSecond)}`)

  // ── what the site serves ──
  const pages = await json('/api/content/page?limit=50')
  ok(pages.total === 3, `content API: ${pages.total} pages, expected 3`)
  const home = (await json('/api/content/page/home')).item
  ok(home.sections.map((b) => b.type).join() === 'hero,text,image,cta', `home blocks: ${home.sections.map((b) => b.type)}`)
  ok(home.sections[0].image?.width === 1600 && home.sections[0].image?.alt, 'the hero picture has no size or description')
  const en = (await json('/api/content/page/home?locale=en')).item
  ok(en.sections[0].heading === 'Bread that smells like morning.', 'the English home page is missing')
  const news = await json('/api/content/news?locale=cs')
  ok(news.total === 3, `content API: ${news.total} published news items (the draft stays out), expected 3`)
  ok((await json('/api/content/news?locale=en')).items.every((n) => /^[A-Z]/.test(n.title) && n.locale === 'en'), 'the English news are missing')
  const settings = (await json('/api/content/_global/siteSettings')).item
  ok(settings.siteName === 'Pekárna Na Růžku' && settings.openingHours.length === 3 && settings.logo?.width === 192, 'site settings are off')
  const hoursEn = (await json('/api/content/_global/siteSettings?locale=en')).item.openingHours
  ok(settings.openingHours[0].days === 'Po–Pá' && hoursEn[0].days === 'Mon–Fri', `opening hours should be in each language: ${settings.openingHours[0].days} / ${hoursEn[0].days}`)
  const nav = (await json('/api/content/_global/navigation')).item
  ok(nav.main.map((l) => l.url).join() === '/,/aktuality,/o-nas,/kontakt', `menu: ${nav.main.map((l) => l.url)}`)
  ok((await json('/api/content/_global/navigation?locale=en')).item.main.map((l) => l.url).join() === '/en,/en/news,/en/about,/en/contact', 'the English menu is off')
  ok((await json('/api/content/_search?q=kvasek')).total > 0, 'search finds nothing in the seeded content')

  const pageChecks = [
    ['/', 'Chléb, který voní po ránu'], ['/en', 'Bread that smells like morning'], ['/o-nas', 'Rodinná pekárna'], ['/en/about', 'A family bakery'],
    ['/kontakt', 'Napište nám'], ['/aktuality', 'Nový žitný chléb s ořechy'], ['/en/news', 'A new rye bread with walnuts'], ['/aktuality/jak-vznika-kvasek', 'Kvásek je jen mouka a voda'],
  ]
  for (const [path, text] of pageChecks) {
    const { res, text: html } = await get(path)
    ok(res.status === 200 && html.includes(text), `${path}: ${res.status}, expected the page to say "${text}"`)
  }
  // the head: canonical, the other language, a language switcher; the hero picture's slot size
  const about = (await get('/o-nas')).text
  ok(about.includes(`<link rel="canonical" href="${base}/o-nas">`) && about.includes(`hreflang="en" href="${base}/en/about"`) && about.includes(`hreflang="x-default" href="${base}/o-nas"`), '/o-nas has no canonical / hreflang links')
  ok(about.includes(`<meta property="og:url" content="${base}/o-nas">`) && about.includes('og:locale" content="cs_CZ"'), '/o-nas has no og:url / og:locale')
  ok(/aria-label="Jazyk"[\s\S]*href="\/en\/about"/.test(about), 'the Czech page has no language switcher to /en/about')
  const aboutEn = (await get('/en/about')).text
  ok(aboutEn.includes(`<link rel="canonical" href="${base}/en/about">`) && /aria-label="Language"[\s\S]*href="\/o-nas"/.test(aboutEn), '/en/about has no canonical or no switcher back to /o-nas')
  const homeHtml = (await get('/')).text
  ok(homeHtml.includes(`<link rel="canonical" href="${base}/">`) && homeHtml.includes(`hreflang="en" href="${base}/en"`), 'the home page should be / (and /en) in its canonical and hreflang links')
  ok(homeHtml.includes('sizes="(min-width: 768px) 30rem, 100vw"'), 'the hero picture should say how wide it shows (sizes)')
  const draftHome = await get('/home?preview')
  ok(draftHome.res.status === 301 && draftHome.res.headers.get('location') === '/?preview', `/home?preview should keep ?preview: ${draftHome.res.status} ${draftHome.res.headers.get('location')}`)

  // the sitemap lists the addresses the website serves, and robots.txt points at it
  const sitemap = (await get('/sitemap.xml')).text
  const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].replace(base, ''))
  for (const want of ['/', '/en', '/aktuality', '/en/news', '/o-nas', '/en/about', '/kontakt']) ok(locs.includes(want), `the sitemap misses ${want}: ${locs}`)
  ok(!locs.some((l) => /\/home$/.test(l)), `the sitemap lists a /home address: ${locs}`)
  const robots = (await get('/robots.txt')).text
  ok(/Disallow: \/admin/.test(robots) && robots.includes(`Sitemap: ${base}/sitemap.xml`), `robots.txt: ${robots}`)

  // what a CDN is told (docs/deploying.md, "Caching")
  const cc = async (path) => (await get(path)).res.headers.get('cache-control')
  ok(await cc('/api/content/page') === 'public, max-age=0, must-revalidate, s-maxage=300', `content API Cache-Control: ${await cc('/api/content/page')}`)
  // (the sitemap is @nuxtjs/sitemap's: it adds s-maxage and stale-while-revalidate)
  ok(String(await cc('/sitemap.xml')).startsWith('public, max-age=3600,') && await cc('/robots.txt') === 'public, max-age=3600', `sitemap and robots.txt should be cached for an hour: ${await cc('/sitemap.xml')}`)
  console.log('Cache-Control of a server-rendered page:', await cc('/o-nas'))

  const moved = await get('/pekarna')
  ok(moved.res.status === 301 && moved.res.headers.get('location') === '/o-nas', `/pekarna should send visitors to /o-nas, got ${moved.res.status} ${moved.res.headers.get('location')}`)

  const mainMenu = async (query = '') => (await json(`/api/content/_global/navigation${query}`)).item.main.map((l) => l.url).join()

  // ── a reset goes through (the menus link to the pages it removes) ──
  // (before the renames below: a renamed page leaves a redirect behind)
  const reset = spawnSync('pnpm', ['seed', '--reset', '--yes'], { cwd: site, encoding: 'utf8', env: { ...process.env, ...seedEnv } })
  process.stdout.write(reset.stdout)
  ok(reset.status === 0, `the reset seed failed:\n${reset.stdout}${reset.stderr}`)
  ok(/− page o-nas/.test(reset.stdout) && /~ navigation/.test(reset.stdout), `the reset should list what it removes, menus included:\n${reset.stdout}`)
  const afterReset = await snapshot()
  ok(afterReset.page === 3 && afterReset.news === 4 && afterReset.media === 5 && afterReset.redirect === 1, `unexpected content after the reset: ${JSON.stringify(afterReset)}`)
  ok(await mainMenu() === '/,/aktuality,/o-nas,/kontakt', `the menu is off after the reset: ${await mainMenu()}`)
  const third = seedRun()
  ok(third.status === 0 && !/✓ (created|updated|uploaded)/.test(third.stdout), `a seed after the reset changed something:\n${third.stdout}${third.stderr}`)

  // ── the menus follow their pages ──
  // The seed stores a link to a page as a reference, so the menu shows the page's address
  // as it is now: rename the page in the admin and the menu changes with it.
  const pageId = async (slug) => (await query(`select id from page where slug = '${slug}'`))[0].id
  const [aboutId, contactId] = [await pageId('o-nas'), await pageId('kontakt')]
  const storedMenu = (await query('select main, footer from navigation'))[0]
  ok(storedMenu.main.map((l) => l.url).join() === `/,/aktuality,cms:page/${aboutId},cms:page/${contactId}`, `the menu should hold references to its pages: ${JSON.stringify(storedMenu.main.map((l) => l.url))}`)
  ok(storedMenu.footer[0].url === `cms:page/${contactId}`, `the footer menu should hold a reference: ${storedMenu.footer[0].url}`)

  const admin = { email: seedEnv.SEED_EMAIL, password: seedEnv.SEED_PASSWORD }
  const login = await fetch(`${base}/api/cms/_auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(admin) })
  ok(login.ok, `could not sign in as the seeded administrator: ${login.status}`)
  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
  const rename = async (id, slug) => {
    const res = await fetch(`${base}/api/cms/page/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', origin: base, cookie }, body: JSON.stringify({ slug }) })
    ok(res.ok, `renaming the page to ${slug}: ${res.status} ${await res.text()}`)
  }
  await rename(aboutId, 'o-nas-nove')
  ok(await mainMenu() === '/,/aktuality,/o-nas-nove,/kontakt', `the menu did not follow the renamed page: ${await mainMenu()}`)
  ok(await mainMenu('?locale=en') === '/en,/en/news,/en/about,/en/contact', 'the English menu changed with the Czech page name')
  await rename(aboutId, 'o-nas')
  ok(await mainMenu() === '/,/aktuality,/o-nas,/kontakt', `the menu did not follow the page back: ${await mainMenu()}`)

  // ── only .output ships (docs/deploying.md, "A client site on any container host") ──
  // A copy of .output alone, started from an empty folder against an empty database with
  // NUXT_CMS_MIGRATIONS_ON_START=true: the bundled migrations create the tables.
  const runDb = `${dbName}_run`
  const runUrl = (() => { const u = new URL(dbUrl); u.pathname = `/${runDb}`; return u.toString() })()
  await withAdmin(async (c) => { await c.query(`drop database if exists "${runDb}" with (force)`); await c.query(`create database "${runDb}"`) })
  const runtime = join(work, 'runtime')
  mkdirSync(runtime)
  cpSync(join(site, '.output'), join(runtime, '.output'), { recursive: true })
  const runPort = await freePort()
  const lone = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: runtime, stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(runPort), DATABASE_URL: runUrl, NUXT_APP_SECRET: env.NUXT_APP_SECRET, NUXT_CMS_PUBLIC_URL: `http://127.0.0.1:${runPort}`, NUXT_CMS_MIGRATIONS_ON_START: 'true', NUXT_CMS_STORAGE_LOCAL_DIR: join(work, 'runtime-uploads') },
  })
  const loneLogs = []
  lone.stdout.on('data', (d) => loneLogs.push(String(d)))
  lone.stderr.on('data', (d) => loneLogs.push(String(d)))
  try {
    for (let i = 0; ; i++) {
      if (lone.exitCode !== null) fail(`.output alone exited with ${lone.exitCode}:\n${loneLogs.join('')}`)
      try { if ((await fetch(`http://127.0.0.1:${runPort}/api/health/ready`)).ok) break } catch { /* not up yet */ }
      if (i > 240) fail(`.output alone did not become ready:\n${loneLogs.join('')}`)
      await new Promise((r) => setTimeout(r, 250))
    }
    const c = new pg.Client({ connectionString: runUrl })
    await c.connect()
    const tables = (await c.query(`select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name in ('page', 'news', 'site_settings')`)).rows[0].n
    await c.end()
    ok(tables === 3, '.output alone, with NUXT_CMS_MIGRATIONS_ON_START=true, did not create the tables')
  }
  finally {
    if (lone.exitCode === null) { lone.kill('SIGTERM'); await new Promise((r) => lone.once('exit', r)) }
    await withAdmin((c) => c.query(`drop database if exists "${runDb}" with (force)`)).catch(() => {})
  }
console.log('  the demo content in both languages, seeded twice (the second run changed nothing), served, its menus follow renamed pages, and a reset goes through')
}

try {
  mkdirSync(packs, { recursive: true })
  run('pnpm', ['pack', '--pack-destination', packs], join(root, 'packages/cms'))
  run('pnpm', ['pack', '--pack-destination', packs], join(root, 'packages/client'))
  run('pnpm', ['pack', '--pack-destination', packs], join(root, 'packages/create-tinyzoo'))
  // `tinyzoo-<version>.tgz`, `tinyzoo-client-<version>.tgz`, `create-tinyzoo-<version>.tgz`: a name, a dash, a digit.
  const tgz = (name) => join(packs, readdirSync(packs).find((f) => f.startsWith(`${name}-`) && /^\d/.test(f.slice(name.length + 1))))
  const files = { cms: tgz('tinyzoo'), client: tgz('tinyzoo-client'), create: tgz('create-tinyzoo') }

  // The packages out of the packed files: unpack the tarballs and run THEIR code (the workspace's
  // installed dependencies are linked in, so they can load).
  const unpack = (tarball, name, modules) => {
    const into = join(work, 'unpacked', name)
    mkdirSync(into, { recursive: true })
    run('tar', ['-xzf', tarball, '-C', into], work)
    symlinkSync(join(root, modules, 'node_modules'), join(into, 'package/node_modules'), 'dir')
    return join(into, 'package')
  }
  const tarballs = { files, cms: unpack(files.cms, 'cms', 'packages/cms'), create: unpack(files.create, 'create', 'packages/create-tinyzoo') }
  ok(existsSync(join(tarballs.cms, 'starter/seed/index.ts')) && existsSync(join(tarballs.cms, 'cli/init.mjs')), 'tinyzoo in the package has no starter/seed or cli/init.mjs')
  ok(existsSync(join(tarballs.create, 'bundle/starter/cms.config.ts')) && existsSync(join(tarballs.create, 'bundle/init.mjs')), 'create-tinyzoo in the package has no bundled starter or init.mjs')
  ok(!existsSync(join(tarballs.create, 'bundle/starter/node_modules')), 'create-tinyzoo bundles a node_modules')

  for (const sc of chosen) await checkScenario(sc, tarballs)
  console.log(`\n✓ starter: ${chosen.map((sc) => sc.id).join(', ')}`)
}
finally {
  if (!process.env.KEEP_STARTER) rmSync(work, { recursive: true, force: true })
  else console.log(`kept: ${work}`)
}
