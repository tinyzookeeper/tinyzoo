// The starter as a new site gets it: `tinyzoo init` from the PACKED package into a fresh
// folder, installed from the tarballs (no workspace links), migrated, built, started, then
// seeded twice with `pnpm seed`. Checks that the demo content arrives once, in both
// languages, that the website serves it, that the menus follow their pages (a page renamed
// in the admin changes the menu), and that `pnpm seed --reset` goes through.
//
//   STARTER_CHECK_DATABASE_URL=postgres://cms:cms@localhost:5434/cms_starter_scratch node scripts/starter-check.mjs
//
// The database is created for the run and dropped at the end; its name must not be one of
// a real site's (it has to contain "scratch" or "test"). Without the variable the name is
// derived from TEST_DATABASE_URL (`<name>_starter`). KEEP_STARTER=1 keeps the folder.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
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
const dbUrl = databaseUrl()
const dbName = new URL(dbUrl).pathname.slice(1)
if (!/^[a-z0-9_]+$/.test(dbName) || !/(scratch|test)/.test(dbName)) throw new Error(`Refusing database "${dbName}": the name must contain "scratch" or "test".`)
const adminUrl = (() => { const u = new URL(dbUrl); u.pathname = '/postgres'; return u.toString() })()

const work = mkdtempSync(join(tmpdir(), 'cms-starter-'))
const packs = join(work, 'packs')
const site = join(work, 'site')
const uploads = join(work, 'uploads')
let server = null
let dbCreated = false
const logs = []
const run = (cmd, args, cwd, env = {}) => execFileSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } })
const fail = (message) => { throw new Error(message) }
const ok = (cond, message) => { if (!cond) fail(message) }

const withAdmin = async (fn) => {
  const c = new pg.Client({ connectionString: adminUrl })
  await c.connect()
  try { return await fn(c) } finally { await c.end() }
}
const query = async (text) => {
  const c = new pg.Client({ connectionString: dbUrl })
  await c.connect()
  try { return (await c.query(text)).rows } finally { await c.end() }
}
const freePort = () => new Promise((resolve, reject) => {
  const srv = createServer()
  srv.unref()
  srv.on('error', reject)
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)) })
})

try {
  mkdirSync(packs, { recursive: true })
  run('pnpm', ['pack', '--pack-destination', packs], join(root, 'packages/cms'))
  run('pnpm', ['pack', '--pack-destination', packs], join(root, 'packages/client'))
  const tgz = (prefix) => join(packs, readdirSync(packs).find((f) => f.startsWith(prefix)))

  // `tinyzoo init` out of the packed files: unpack the tarball and run ITS cli (the
  // workspace's installed dependencies are linked in, so it can load).
  const unpacked = join(work, 'unpacked')
  mkdirSync(unpacked)
  run('tar', ['-xzf', tgz('tinyzoo-0'), '-C', unpacked], work)
  symlinkSync(join(root, 'packages/cms/node_modules'), join(unpacked, 'package/node_modules'), 'dir')
  const init = spawnSync(join(root, 'packages/cms/node_modules/.bin/tsx'), [join(unpacked, 'package/cli/index.ts'), 'init', site], { cwd: root, encoding: 'utf8' })
  process.stdout.write(init.stdout)
  process.stderr.write(init.stderr)
  ok(init.status === 0, 'tinyzoo init failed')
  ok(/pnpm seed/.test(init.stdout), 'tinyzoo init does not mention `pnpm seed` in its next steps')
  ok(existsSync(join(site, 'seed/index.ts')) && existsSync(join(site, 'seed/media/hero.jpg')), 'the starter in the package has no seed/ with its pictures')

  // Tarballs instead of version ranges, and one copy of the editor stack (as in the workspace).
  const pkgPath = join(site, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  // `tinyzoo init` writes the package's own version as the range (a released 0.2.0 writes ^0.2.0).
  const packed = JSON.parse(readFileSync(join(root, 'packages/cms/package.json'), 'utf8')).version
  ok(pkg.dependencies.tinyzoo === `^${packed}` && pkg.dependencies['@tinyzoo/client'] === `^${packed}`, `tinyzoo init should write ^${packed} for tinyzoo and @tinyzoo/client, got ${pkg.dependencies.tinyzoo} and ${pkg.dependencies['@tinyzoo/client']}`)
  pkg.dependencies.tinyzoo = `file:${tgz('tinyzoo-0')}`
  pkg.dependencies['@tinyzoo/client'] = `file:${tgz('tinyzoo-client-')}`
  pkg.pnpm = { overrides: { '@tiptap/core': '3.34.0', '@tiptap/pm': '3.34.0', 'prosemirror-model': '^1.25.13', 'prosemirror-state': '^1.4.4', 'prosemirror-view': '^1.41.0' } }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
  run('pnpm', ['install', '--ignore-workspace', '--no-frozen-lockfile'], site)

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
  const setupCode = /Setup code: ([A-Z0-9]{4}(?:-[A-Z0-9]{4}){3})/.exec(logs.join(''))?.[1]
  ok(setupCode, 'the site did not print a setup code (a new production site must)')

  // ── seed twice ──
  const seedEnv = { SEED_URL: base, SEED_EMAIL: 'starter@example.com', SEED_PASSWORD: 'correct horse battery', SEED_SETUP_CODE: setupCode }
  const seedRun = () => spawnSync('pnpm', ['seed'], { cwd: site, encoding: 'utf8', env: { ...process.env, ...seedEnv } })
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
  const get = async (path, init) => { const res = await fetch(base + path, { redirect: 'manual', ...init }); return { res, text: await res.text() } }
  const json = async (path) => JSON.parse((await get(path)).text)
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

  console.log('✓ starter initialised from the packed package, seeded twice (second run changed nothing), served the demo content, its menus follow renamed pages, and a reset goes through')
}
finally {
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await new Promise((r) => server.once('exit', r)) }
  if (dbCreated) await withAdmin((c) => c.query(`drop database if exists "${dbName}" with (force)`)).catch((e) => console.error('could not drop', dbName, e.message))
  if (!process.env.KEEP_STARTER) rmSync(work, { recursive: true, force: true })
  else console.log(`kept: ${work}`)
}
