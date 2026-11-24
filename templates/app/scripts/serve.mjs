// Serve sites of some templates from a built server, one per look, until stopped (Ctrl+C):
// to look at a build by hand, or to measure it (scripts/measure.mjs).
//
//   node templates/app/scripts/serve.mjs --entry <.output/server/index.mjs> --templates photographer,wedding
//        --pg postgres://user:pw@host:port/postgres --prefix tzserve_ [--model] [--seed] [--port 4890]
//        [--templates-dir <folder>] [--data <folder>]
//
// `--seed` makes the databases anew and fills them; without it the databases of an earlier run
// with the same prefix are used as they are.
import { join, resolve } from 'node:path'
import { arg, freePortFrom, log, makeSites, repoRoot, seedSite, sitesFor, startServer, writeDirectory } from './sites.mjs'

const entry = arg('entry')
const pgUrl = arg('pg')
const prefix = arg('prefix')
const templatesDir = resolve(arg('templates-dir', join(repoRoot, 'templates')))
const templates = String(arg('templates', '')).split(',').filter(Boolean)
if (!entry || !pgUrl || !prefix || !templates.length) {
  console.error('usage: serve.mjs --entry <server> --templates a,b --pg <postgres url> --prefix <db prefix_> [--model] [--seed] [--port <n>]')
  process.exit(2)
}
const seed = arg('seed', false) === true
const port = Number(arg('port', 0)) || await freePortFrom(4890)
const dataDir = resolve(arg('data', join(repoRoot, 'templates', 'app', '.data', prefix)))
const rows = await makeSites({ pgUrl, prefix, dataDir, port, sites: await sitesFor(templatesDir, templates), model: arg('model', false) === true, keep: !seed })
const directoryFile = join(dataDir, 'sites.json')
writeDirectory(directoryFile, rows)
const server = await startServer({ entry, directoryFile, port, logFile: join(dataDir, 'server.log') })
log(`server ${server.pid} on port ${port}, answering after ${Math.round(server.readyMs)} ms`)
if (seed) for (const row of rows) { seedSite(row, templatesDir); log(`seeded ${row._site.slug}`) }
for (const row of rows) console.log(`  ${row._site.url}`)
console.log(`SERVER_PID=${server.pid}`)
const stop = async () => { await server.stop(); log('stopped'); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
setInterval(() => {}, 1 << 30)
