import type { H3Event } from 'h3'
import type { Locale } from '#shared/templates'

/** E-mail the link that confirms someone's address. Returns the link itself only where pages may show it (development, e-mail printed). */
export async function sendVerification(event: H3Event, user: { id: string; email: string; name: string; locale: Locale }): Promise<string | null> {
  const secret = await issueEmailToken(user.id, 'verify', VERIFY_TTL_MS)
  const url = `${publicUrl(event)}/verify/${secret}`
  await sendMail(verifyEmail(user, url))
  rememberDevLink(user.id, 'verify', url)
  return showsMailLinks() ? url : null
}
