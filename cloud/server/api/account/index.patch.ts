import { eq } from 'drizzle-orm'
import { z } from 'zod'

// Change my name or language.
const input = z.object({ name: nameSchema.optional(), locale: localeSchema.optional() })

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const data = await readInput(event, input)
  if (data.name === undefined && data.locale === undefined) return { ok: true }
  await useDb().update(schema.users).set({ ...(data.name !== undefined ? { name: data.name } : {}), ...(data.locale ? { locale: data.locale } : {}) }).where(eq(schema.users.id, me.id))
  if (data.name !== undefined) await startSession(event, me.id)
  return { ok: true }
})
