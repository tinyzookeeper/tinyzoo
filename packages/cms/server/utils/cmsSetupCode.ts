import { eq, generateSetupCode, normalizeSetupCode, sql } from 'tinyzoo'

/**
 * The setup code of a fresh production deploy.
 *
 * `NUXT_CMS_AUTH_SETUP_TOKEN` is optional, so without it anyone opening
 * /admin/setup on a new deploy would become its administrator. In production, with
 * no token configured and no account yet, the app makes a random one-time code
 * instead and prints it in the log: whoever deployed the site can read it, a
 * visitor cannot.
 *
 * Several replicas share one code: it lives in `cms_state` (key `setup_code`), only
 * as a hash. The instance that stores it prints it; the others find it there and
 * print where to look. It is removed when the first account exists (in the same
 * transaction as the account itself, see setup.post.ts).
 */
export const SETUP_CODE_KEY = 'setup_code'

/** A code printed less than this long ago is left alone: its log line is still the one to read. */
const REISSUE_AFTER = '5 minutes'

/**
 * A built server counts as production unless it says otherwise (NODE_ENV=development
 * or test, or `nuxt dev`): an unset NODE_ENV must not leave a deploy open.
 */
export function isProductionServer(): boolean {
  if (import.meta.dev) return false
  const env = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined
  return env !== 'development' && env !== 'test'
}

/** True when first-run setup asks for a generated code: production, built-in sign-in, no configured token. */
export function setupCodeApplies(): boolean {
  return cmsAuthMode() === 'builtin' && !setupToken() && isProductionServer()
}

async function noAccountYet(db: any, reg: any): Promise<boolean> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(reg.cmsUsers)
  return Number(row?.n ?? 0) === 0
}

/**
 * Make sure a code exists while there is no account, and print it when this call
 * made it. At start (`reissue`) an older code whose plain text is gone is replaced
 * and printed again; later calls (the status endpoint) only fill a gap.
 */
export async function ensureSetupCode(opts: { reissue?: boolean } = {}): Promise<'issued' | 'exists' | 'not-needed'> {
  if (!setupCodeApplies()) return 'not-needed'
  const { db, reg } = useCms()
  const s = reg.cmsState
  if (!(await noAccountYet(db, reg))) {
    await db.delete(s).where(eq(s.key, SETUP_CODE_KEY)) // a leftover of an earlier run
    return 'not-needed'
  }
  const code = generateSetupCode()
  const value = { hash: await sha256Hex(normalizeSetupCode(code)), at: new Date().toISOString() }
  const insert = db.insert(s).values({ key: SETUP_CODE_KEY, value })
  const rows: any[] = opts.reissue
    ? await insert.onConflictDoUpdate({
      target: s.key,
      set: { value, updatedAt: sql`now()` },
      setWhere: sql`${s.updatedAt} < now() - ${REISSUE_AFTER}::interval`,
    }).returning({ key: s.key })
    : await insert.onConflictDoNothing().returning({ key: s.key })
  if (rows.length) {
    const base = String((useRuntimeConfig().cms as any)?.publicUrl || '').replace(/\/+$/, '')
    console.warn(`[cms] No administrator yet. Setup code: ${code} — open ${base}/admin/setup`)
    return 'issued'
  }
  if (opts.reissue) console.warn('[cms] No administrator yet. A setup code was issued a moment ago (by another instance) — look for "Setup code:" in the log.')
  return 'exists'
}

/**
 * May setup go on with what the person typed? Not asked once an account exists (the
 * setup endpoint then answers "already set up" whatever was typed); until then it must
 * be the current code.
 */
export async function setupCodeAccepts(input: unknown): Promise<boolean> {
  if (await verifySetupCode(input)) return true
  const { db, reg } = useCms()
  return !(await noAccountYet(db, reg))
}

/** Is `input` the current setup code? Compares hashes in constant time. */
export async function verifySetupCode(input: unknown): Promise<boolean> {
  const typed = normalizeSetupCode(input)
  const { db, reg } = useCms()
  const [row] = await db.select().from(reg.cmsState).where(eq(reg.cmsState.key, SETUP_CODE_KEY))
  const value = (row?.value ?? {}) as { hash?: unknown }
  const stored = typeof value.hash === 'string' ? value.hash : ''
  // Hash even a missing or empty input, so the time does not tell whether a code exists.
  const given = await sha256Hex(typed)
  return !!stored && !!typed && constantTimeEqual(given, stored)
}
