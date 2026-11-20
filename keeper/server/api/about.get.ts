import type { KeeperAbout } from '#keeper/types/keeper'

// GET /api/about — what Settings → About shows besides Keeper's own version (that one is in
// the build): the newest tinyzoo release Keeper knows and when npm last confirmed it. Asks npm
// again when that answer is over 10 minutes old.
export default defineEventHandler(async (event): Promise<KeeperAbout> => {
  await requireMember(event)
  const latest = await latestReleaseInfo()
  return { tinyzoo: latest ? { version: latest.version, checkedAt: latest.checkedAt.toISOString() } : null }
})
