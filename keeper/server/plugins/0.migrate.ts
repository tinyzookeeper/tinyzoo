import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

// Keeper migrates its own database when it starts, with drizzle's bookkeeping (so
// `drizzle-kit migrate` can take over). The SQL ships inside the server build as server
// assets (nuxt.config.ts), so a deployment needs nothing but its .output; drizzle's
// migrator reads a folder, so the files are written to a temporary one first.
// NUXT_MIGRATIONS_DIR points at a folder to use instead.
async function bundledFolder(): Promise<string | null> {
  const assets = useStorage('assets:keeper-migrations')
  const keys = await assets.getKeys()
  if (!keys.length) return null
  const dir = await mkdtemp(join(tmpdir(), 'keeper-migrations-'))
  for (const key of keys) {
    const path = join(dir, ...key.split(':'))
    const value = await assets.getItemRaw(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, typeof value === 'string' ? value : Buffer.from(value as ArrayBuffer))
  }
  return dir
}

export default defineNitroPlugin(() => {
  const configured = String(useRuntimeConfig().migrationsDir || '')
  setMigrations((async () => {
    const dir = configured || await bundledFolder()
    if (!dir) {
      console.warn('[keeper] no migrations bundled; set NUXT_MIGRATIONS_DIR')
      return
    }
    await migrate(useDb(), { migrationsFolder: dir })
    console.info('[keeper] database is up to date')
  })().catch((err) => {
    console.error('[keeper] migrations failed', err?.message ?? err)
    if (process.env.NODE_ENV === 'production') setTimeout(() => process.exit(1), 100)
    throw err
  }))
})
