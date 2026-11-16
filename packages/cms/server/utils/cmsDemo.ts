import { eq, sql } from 'tinyzoo'

// A public demo admin (cms.demo / NUXT_PUBLIC_CMS_DEMO_*): one shared editor account
// whose sign-in details are printed on the sign-in page. It is created, or put back
// (editor, active, the published password), whenever someone signs in with exactly
// those details, so a nightly content reset or a broken account never locks people
// out. It cannot change its name or password, and gets no reset emails.

/** The demo account's details, or null when the site has no demo. */
export function cmsDemo(): { email: string; password: string } | null {
  const d = (useRuntimeConfig().public as any)?.cmsDemo
  const email = String(d?.email ?? '').trim().toLowerCase()
  const password = String(d?.password ?? '')
  return email && password ? { email, password } : null
}

export function isDemoAccount(email: string | null | undefined): boolean {
  const d = cmsDemo()
  return !!d && !!email && email.trim().toLowerCase() === d.email
}

/** Before a sign-in: when these are the demo details, make sure the account works. */
// The account's name, the same in every admin language.
const DEMO_NAME = 'Demo'

export async function ensureDemoAccount(email: string, password: string): Promise<void> {
  const d = cmsDemo()
  if (!d || email !== d.email || password !== d.password) return
  const { db, reg } = useCms()
  const [user] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.email, d.email))
  const fine = user && user.name === DEMO_NAME && user.status === 'active' && user.role === 'editor' && user.passwordHash && await verifyPassword(user.passwordHash, d.password)
  if (fine) return
  const values = { name: DEMO_NAME, role: 'editor', status: 'active', passwordHash: await hashPassword(d.password), updatedAt: new Date() }
  if (user) await db.update(reg.cmsUsers).set({ ...values, sessionVersion: sql`${reg.cmsUsers.sessionVersion} + 1` }).where(eq(reg.cmsUsers.id, user.id))
  else await db.insert(reg.cmsUsers).values({ email: d.email, ...values }).onConflictDoNothing()
}
