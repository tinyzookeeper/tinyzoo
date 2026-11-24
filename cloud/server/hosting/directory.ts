import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decryptSiteRow, encryptSiteRow, isDirectorySecret } from '../../shared/directorySecret'
import { parseSharedDirectory, sharedDirectoryText, sharedReaderRole, sharedReaderUrl, sqlLiteral, type SharedSiteRow } from '../../shared/sharedHosting'
import { quoteIdent } from '../../shared/slug'
import { HostingError } from './types'

// The site directory of one app, as the shared driver uses it: where the rows of the app's
// sites are kept and how the app's process is told to read them. Two places:
//
//  - `file`      `<app folder>/sites.json`, readable by its owner only. The process
//                rereads it when it changes.
//  - `postgres`  the table `tenant_sites` in the cloud's own database (server/db/schema.ts).
//                The process reads it with a role of its own that may read that one table,
//                and only the rows of its own app, and looks at it again every second.
//                The column `template` holds the APP's id (`templates`, `basic`); the model
//                a site uses is inside its row.
//
// The driver works with rows in plain text. What is STORED has every secret encrypted with
// the directory key (shared/directorySecret.ts) whenever a key is set; the table is never
// written without one. The rest of the driver does not care which of the two it talks to.

export type DirectoryKind = 'file' | 'postgres'

/** The role an app's process reads the table with: its name, and its password encrypted as the cloud keeps secrets. */
export interface DirectoryReader { role: string; password: string }

export interface SiteDirectory {
  readonly kind: DirectoryKind
  /** Is the directory there: the file exists; the table holds a row of this app. When it is not, the driver writes every site of the app again. */
  present(): Promise<boolean>
  /** The rows as they are stored now, secrets in plain text. */
  rows(): Promise<SharedSiteRow[]>
  /** Read, change and write in one turn, one writer at a time. Resolves to whether anything was changed. */
  change(change: (rows: SharedSiteRow[]) => { rows: SharedSiteRow[]; changed: boolean }): Promise<boolean>
  /**
   * Before the app's process starts: the directory exists, and so does what the process
   * reads it with. Resolves to the process's environment for it, and the reader to remember.
   */
  prepare(known: DirectoryReader | undefined): Promise<{ env: Record<string, string>; reader?: DirectoryReader }>
}

export interface DirectoryOptions { kind: DirectoryKind; key: string; appId: string; appDir: string; databasePrefix: string }

export const directoryFilePath = (appDir: string): string => join(appDir, 'sites.json')

/** Write a file that only its owner may read, in one move: a temporary file beside it, then a rename. */
export function writePrivate(file: string, text: string): void {
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, text, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, file)
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** A stored row is as it should be: with a key, its password and its secret are encrypted. */
const sealed = (stored: SharedSiteRow, key: string) => !key || (isDirectorySecret(stored.databaseUrl) && isDirectorySecret(stored.secret))

interface Read {
  /** Rows that could be read, in plain text, with what is stored for each. */
  plain: SharedSiteRow[]
  stored: Map<string, SharedSiteRow>
  /** Rows whose secrets this key does not open: kept as they are, never dropped by a write. */
  closed: SharedSiteRow[]
}

function open(list: SharedSiteRow[], key: string): Read {
  const read: Read = { plain: [], stored: new Map(), closed: [] }
  for (const stored of list) {
    try {
      const plain = decryptSiteRow(stored, key)
      read.plain.push(plain)
      read.stored.set(plain.id, stored)
    }
    catch {
      read.closed.push(stored)
    }
  }
  return read
}

/**
 * What to store for the rows after a change: a row that did not change keeps what was stored
 * for it (its text stays the same), a new or changed one is encrypted now. `rewrite` says
 * that something stored was not as it should be (a password in plain text although a key is set).
 */
function seal(before: Read, after: SharedSiteRow[], key: string): { list: SharedSiteRow[]; written: string[]; removed: string[] } {
  const written: string[] = []
  const list = after.map((row) => {
    const stored = before.stored.get(row.id)
    const was = before.plain.find((r) => r.id === row.id)
    if (stored && was && same(was, row) && sealed(stored, key)) return stored
    written.push(row.id)
    return encryptSiteRow(row, key)
  })
  const kept = new Set(after.map((r) => r.id))
  const removed = before.plain.filter((r) => !kept.has(r.id)).map((r) => r.id)
  // Rows this key cannot open stay, unless the change wrote a row under the same id.
  return { list: [...list, ...before.closed.filter((r) => !kept.has(r.id))], written, removed }
}

// ── a file ──────────────────────────────────────────────────────────────────────

// One writer at a time, and the file is read again inside the turn: two sites made at the
// same moment never lose each other's row. (One chain for all apps: a turn is a read and a write.)
let writing: Promise<unknown> = Promise.resolve()

function fileDirectory(opts: DirectoryOptions): SiteDirectory {
  const file = directoryFilePath(opts.appDir)
  const read = (): Read => {
    try { return open(parseSharedDirectory(readFileSync(file, 'utf8')), opts.key) }
    catch { return open([], opts.key) }
  }
  const directory: SiteDirectory = {
    kind: 'file',
    present: async () => existsSync(file),
    rows: async () => read().plain,
    change(change) {
      const next = writing.then(() => {
        const missing = !existsSync(file)
        const before = read()
        const { rows, changed } = change(before.plain)
        const after = seal(before, rows, opts.key)
        const rewrite = after.written.length > 0 || after.removed.length > 0
        if (changed || missing || rewrite) writePrivate(file, sharedDirectoryText(after.list))
        return changed
      })
      writing = next.catch(() => {})
      return next
    },
    async prepare() {
      // The process reads the directory when it starts: it must exist, if only empty. (Not written
      // for a process that runs: an empty directory would make it drop every site for a moment.)
      await directory.change((rows) => ({ rows, changed: false }))
      return { env: { NUXT_CMS_TENANCY_FILE: file, ...(opts.key ? { NUXT_CMS_TENANCY_KEY: opts.key } : {}) } }
    },
  }
  return directory
}

// ── the table ───────────────────────────────────────────────────────────────────

/**
 * The reader of an app: a Postgres role that may sign in, connect to the cloud's database
 * and read `tenant_sites`, and only the rows of its own app. Made once; its password is kept
 * encrypted with the app's other state (app.json). When that was lost the role gets a new
 * password: a process that still runs keeps its open connection, and the next start uses the new one.
 */
async function ensureReader(role: string, appId: string, known: DirectoryReader | undefined): Promise<{ reader: DirectoryReader; password: string }> {
  const pool = usePool()
  const ident = quoteIdent(role)
  const { rows: [db] } = await pool.query<{ name: string }>('select current_database() as name')
  const exists = !!(await pool.query('select 1 from pg_roles where rolname = $1', [role])).rowCount
  const grant = async () => {
    // The cloud's own database is closed to everybody else (the driver revokes PUBLIC's right): the reader is let in by name.
    await pool.query(`grant connect on database ${quoteIdent(db!.name)} to ${ident}`)
    await pool.query(`grant select on table tenant_sites to ${ident}`)
  }
  // The grant is on the whole table, so on its own it would let a role read the rows of every
  // app. Row level security narrows it to the rows of the role's own app. The cloud's own user
  // owns the table, so the policies do not limit it. The policy is made or changed with one
  // statement, never dropped and made again: a process that runs reads the table every second
  // and must never see it empty.
  const limit = async () => {
    await pool.query('alter table tenant_sites enable row level security')
    const has = !!(await pool.query('select 1 from pg_policies where schemaname = current_schema() and tablename = $1 and policyname = $2', ['tenant_sites', role])).rowCount
    const using = `using (template = ${sqlLiteral(appId)})`
    await pool.query(has ? `alter policy ${ident} on tenant_sites to ${ident} ${using}` : `create policy ${ident} on tenant_sites for select to ${ident} ${using}`)
  }
  const kept = exists && known?.role === role ? decryptSecret(known.password) : null
  if (kept) {
    await grant()
    await limit()
    return { reader: known!, password: kept }
  }
  const password = randomBytes(24).toString('base64url')
  // A role takes no parameters: the password goes in as a literal.
  await pool.query(`${exists ? 'alter' : 'create'} role ${ident} login password ${sqlLiteral(password)} nosuperuser nocreatedb nocreaterole noreplication`)
  await grant()
  await limit()
  return { reader: { role, password: encryptSecret(password) }, password }
}

function tableDirectory(opts: DirectoryOptions): SiteDirectory {
  const needKey = () => {
    if (!opts.key) throw new HostingError('start_failed', 'the site directory in Postgres needs a key: set NUXT_HOSTING_SHARED_DIRECTORY_KEY (32 or more characters)')
  }
  const read = async (client: { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> }): Promise<Read> => {
    const { rows } = await client.query('select row from tenant_sites where template = $1 order by id', [opts.appId])
    return open(rows.map((r) => r.row as SharedSiteRow).filter((r) => r && typeof r.id === 'string'), opts.key)
  }
  return {
    kind: 'postgres',
    async present() {
      return !!(await usePool().query('select 1 from tenant_sites where template = $1 limit 1', [opts.appId])).rowCount
    },
    async rows() {
      needKey()
      return (await read(usePool())).plain
    },
    async change(change) {
      needKey()
      const client = await usePool().connect()
      try {
        await client.query('begin')
        // One writer per app at a time; the rows are read again inside the turn.
        await client.query('select pg_advisory_xact_lock(hashtext($1))', [`tinyzoo-cloud:directory:${opts.appId}`])
        const before = await read(client)
        const { rows, changed } = change(before.plain)
        const after = seal(before, rows, opts.key)
        for (const id of after.written) {
          const row = after.list.find((r) => r.id === id)!
          // `updated_at` changes with every write (the wall clock, not the transaction's start): it is how the process notices.
          await client.query(
            `insert into tenant_sites (id, template, row, updated_at) values ($1, $2, $3, clock_timestamp())
             on conflict (id) do update set template = excluded.template, row = excluded.row, updated_at = clock_timestamp()`,
            [id, opts.appId, JSON.stringify(row)],
          )
        }
        if (after.removed.length) await client.query('delete from tenant_sites where template = $1 and id = any($2)', [opts.appId, after.removed])
        await client.query('commit')
        return changed
      }
      catch (err) {
        await client.query('rollback').catch(() => {})
        throw err
      }
      finally {
        client.release()
      }
    },
    async prepare(known) {
      needKey()
      const { reader, password } = await ensureReader(sharedReaderRole(opts.appId, opts.databasePrefix), opts.appId, known)
      const { rows: [db] } = await usePool().query<{ name: string }>('select current_database() as name')
      return {
        reader,
        env: {
          NUXT_CMS_TENANCY_DATABASE_URL: sharedReaderUrl(databaseUrl(), db!.name, reader.role, password),
          NUXT_CMS_TENANCY_TEMPLATE: opts.appId,
          NUXT_CMS_TENANCY_KEY: opts.key,
        },
      }
    },
  }
}

export function siteDirectory(opts: DirectoryOptions): SiteDirectory {
  return opts.kind === 'postgres' ? tableDirectory(opts) : fileDirectory(opts)
}
