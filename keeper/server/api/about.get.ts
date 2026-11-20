import { eq } from 'drizzle-orm'
import type { KeeperAbout } from '#keeper/types/keeper'

// GET /api/about — what Settings → About shows besides Keeper's own version (that one is in
// the build): the newest tinyzoo release Keeper knows and when npm last told it. Read as
// stored, never fetched here: the daily task asks npm.
export default defineEventHandler(async (event): Promise<KeeperAbout> => {
  await requireMember(event)
  const [row] = await useDb().select().from(schema.state).where(eq(schema.state.key, 'latest'))
  const version = (row?.value as { version?: string } | undefined)?.version ?? null
  return { tinyzoo: version ? { version, checkedAt: row!.updatedAt.toISOString() } : null }
})
