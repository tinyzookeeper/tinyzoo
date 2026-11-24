// A guest reserves a gift: POST /api/gift/<id>/reserve. The gift then says "reserved" on the
// website for everyone; nothing about the guest is kept. The couple can offer it again in the
// admin (Gifts → Reserved off). A contribution anyone can add to (`open`) cannot be reserved.
import { and, eq } from 'drizzle-orm'
import { gift } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  // A few reservations from one address are a family choosing; many are something else.
  if (!(await rateLimit(`gift-reserve:${clientIp(event)}`, 8, 10 * 60_000))) throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  const { db } = useCms()
  const rows = await db.update(gift).set({ reserved: true, updatedAt: new Date() })
    .where(and(eq(gift.id, id), eq(gift.open, false)))
    .returning({ id: gift.id })
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return { id, reserved: true }
})
