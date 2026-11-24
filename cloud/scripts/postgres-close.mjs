// Close a Postgres server to the websites' database users: the once-per-server step of the
// shared hosting driver (docs/multi-tenant-plan.md, 2.3).
//
//   pnpm --filter tinyzoo-cloud postgres:close --url postgres://admin:…@host:5432/postgres          # shows what it would do
//   pnpm --filter tinyzoo-cloud postgres:close --url postgres://admin:…@host:5432/postgres --yes    # does it
//
// A new Postgres role may connect to every database of its server (the right belongs to
// PUBLIC, which every role is part of), even where it can read nothing. The shared driver
// closes each site's own database and the cloud's when it makes them. This script closes
// EVERY database of the server the sites' databases live on, `postgres` and `template1`
// included:
//
//   REVOKE CONNECT ON DATABASE <each one> FROM PUBLIC
//
// After it a site's user can connect to its own database and to no other. The owner of a
// database and superusers connect as before. Anybody else who used a database through
// PUBLIC's right (another application's user that does not own its database) is locked out
// until it is granted by name: GRANT CONNECT ON DATABASE <db> TO <role>.
//
// It changes access to databases that are not the cloud's, so it is explicit: the server is
// named with --url (or CLOUD_PG_URL), never guessed; it prints every database and what it
// would do; and it changes nothing without --yes. It needs a superuser, or a role that owns
// every database.
import pg from 'pg'

const args = process.argv.slice(2)
const valueOf = (name) => { const i = args.indexOf(`--${name}`); return i === -1 ? undefined : args[i + 1] }
const yes = args.includes('--yes')
const url = valueOf('url') || process.env.CLOUD_PG_URL

if (!url || url.startsWith('--')) {
  console.error('Which server? Name it: --url postgres://<a superuser>:<password>@<host>:<port>/postgres (or CLOUD_PG_URL).\nNothing was changed.')
  process.exit(2)
}

const quote = (name) => `"${String(name).replace(/"/g, '""')}"`
const where = (() => { try { const u = new URL(url); return `${u.hostname}:${u.port || 5432}` } catch { return 'the server' } })()

const client = new pg.Client({ connectionString: url })
try {
  await client.connect()
}
catch (err) {
  console.error(`Cannot connect to ${where}: ${err.message}\nNothing was changed.`)
  process.exit(1)
}

let failed = 0
try {
  const me = (await client.query('select current_user as name, (select rolsuper from pg_roles where rolname = current_user) as super')).rows[0]
  const databases = (await client.query(
    `select d.datname as name, r.rolname as owner, d.datistemplate as template, has_database_privilege('public', d.datname, 'CONNECT') as open
       from pg_database d join pg_roles r on r.oid = d.datdba order by d.datname`,
  )).rows
  const open = databases.filter((d) => d.open)
  console.log(`Postgres at ${where}, as ${me.name}${me.super ? ' (superuser)' : ''}: ${databases.length} database(s), ${open.length} open to every role of the server.\n`)
  const width = Math.max(8, ...databases.map((d) => d.name.length))
  console.log(`  ${'database'.padEnd(width)}  ${'owner'.padEnd(16)}  everybody may connect`)
  for (const d of databases) console.log(`  ${d.name.padEnd(width)}  ${String(d.owner).padEnd(16)}  ${d.open ? 'yes' : 'no (closed already)'}`)
  console.log('')

  if (!open.length) {
    console.log('Every database is closed already. Nothing to do.')
  }
  else if (!yes) {
    console.log(`With --yes this would run, for ${open.length} database(s):`)
    for (const d of open) console.log(`  REVOKE CONNECT ON DATABASE ${quote(d.name)} FROM PUBLIC;`)
    console.log('\nNothing was changed. Owners of a database and superusers keep their access; any other role that connects')
    console.log('to one of these databases today needs: GRANT CONNECT ON DATABASE <database> TO <role>. Add --yes to go ahead.')
  }
  else {
    for (const d of open) {
      try {
        await client.query(`revoke connect on database ${quote(d.name)} from public`)
        console.log(`  closed  ${d.name}`)
      }
      catch (err) {
        failed++
        console.log(`  FAILED  ${d.name}: ${err.message}`)
      }
    }
    const still = (await client.query(`select datname as name from pg_database where has_database_privilege('public', datname, 'CONNECT') order by 1`)).rows.map((r) => r.name)
    console.log(`\n${open.length - failed} database(s) closed${failed ? `, ${failed} failed` : ''}. Open to every role now: ${still.length ? still.join(', ') : 'none'}.`)
    console.log('A new database is open again until it is closed: the shared driver closes each one it makes; run this again after making one by hand.')
    if (still.length) failed ||= 1
  }
}
finally {
  await client.end().catch(() => {})
}
process.exit(failed ? 1 : 0)
