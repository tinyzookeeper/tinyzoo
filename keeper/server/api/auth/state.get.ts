import { sql } from 'drizzle-orm'

// Public: whether Keeper still needs its first account, and whether setup asks for a token.
export default defineEventHandler(async () => {
  await migrationsReady()
  const [row] = await useDb().select({ n: sql<number>`count(*)::int` }).from(schema.users)
  return { needsSetup: (row?.n ?? 0) === 0, needsToken: !!useRuntimeConfig().setupToken || process.env.NODE_ENV === 'production' }
})
