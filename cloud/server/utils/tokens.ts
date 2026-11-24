import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'

// The links sent by e-mail. The secret in the link is random; the database keeps its SHA-256.

export const VERIFY_TTL_MS = 3 * 24 * 60 * 60_000
export const RESET_TTL_MS = 60 * 60_000

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex')

/** A fresh link secret for someone. Earlier unused links of the same kind stop working. */
export async function issueEmailToken(userId: string, kind: 'verify' | 'reset', ttlMs: number): Promise<string> {
  const db = useDb()
  const secret = randomBytes(32).toString('base64url')
  await db.delete(schema.emailTokens).where(and(eq(schema.emailTokens.userId, userId), eq(schema.emailTokens.kind, kind), isNull(schema.emailTokens.usedAt)))
  await db.insert(schema.emailTokens).values({ userId, kind, tokenHash: hash(secret), expiresAt: new Date(Date.now() + ttlMs) })
  return secret
}

/** Use a link: whose it was, or null when it is unknown, used or expired. It works once. */
export async function consumeEmailToken(secret: string, kind: 'verify' | 'reset'): Promise<string | null> {
  if (!secret || secret.length > 200) return null
  const [row] = await useDb().update(schema.emailTokens).set({ usedAt: new Date() })
    .where(and(eq(schema.emailTokens.tokenHash, hash(secret)), eq(schema.emailTokens.kind, kind), isNull(schema.emailTokens.usedAt), gt(schema.emailTokens.expiresAt, new Date())))
    .returning({ userId: schema.emailTokens.userId })
  return row?.userId ?? null
}

/** Whether a link would still work, without using it (the page shows the form or says it has expired). */
export async function peekEmailToken(secret: string, kind: 'verify' | 'reset'): Promise<boolean> {
  if (!secret || secret.length > 200) return false
  const [row] = await useDb().select({ id: schema.emailTokens.id }).from(schema.emailTokens)
    .where(and(eq(schema.emailTokens.tokenHash, hash(secret)), eq(schema.emailTokens.kind, kind), isNull(schema.emailTokens.usedAt), gt(schema.emailTokens.expiresAt, new Date())))
  return !!row
}
