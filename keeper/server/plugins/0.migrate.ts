import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

// Keeper migrates its own database when it starts (drizzle's bookkeeping, so
// `drizzle-kit migrate` can take over). The image ships the SQL in NUXT_MIGRATIONS_DIR.
export default defineNitroPlugin(() => {
  const dir = String(useRuntimeConfig().migrationsDir || '') || resolve(process.cwd(), 'server/db/migrations')
  if (!existsSync(dir)) {
    console.warn(`[keeper] no migrations at ${dir}; set NUXT_MIGRATIONS_DIR`)
    return
  }
  setMigrations(migrate(useDb(), { migrationsFolder: dir })
    .then(() => console.info('[keeper] database is up to date'))
    .catch((err) => {
      console.error('[keeper] migrations failed', err?.message ?? err)
      if (process.env.NODE_ENV === 'production') setTimeout(() => process.exit(1), 100)
      throw err
    }))
})
