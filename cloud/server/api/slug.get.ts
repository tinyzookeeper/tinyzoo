import type { SlugCheck } from '#shared/api'
import { firstFreeSlug } from '#shared/slug'

// Whether an address can be had: its shape, whether it is reserved (also by the deployment's
// own list, NUXT_RESERVED_SLUGS) and whether a website holds it. Asked as someone types.
export default defineEventHandler(async (event): Promise<SlugCheck> => {
  await migrationsReady()
  const slug = String(getQuery(event).slug ?? '').slice(0, 80)
  if (tooManyAttempts(`slug:${clientIp(event)}`, 240, 60_000)) throw fail(429, 'tooMany', 'Too many requests')
  const problem = newSlugProblem(slug)
  if (problem) return { slug, ok: false, problem, suggestion: null }
  if (await slugTaken(slug)) return { slug, ok: false, problem: 'taken', suggestion: await firstFreeSlug(slug, async (s) => reservedSlugs().has(s) || await slugTaken(s)) }
  return { slug, ok: true, problem: null, suggestion: null }
})
