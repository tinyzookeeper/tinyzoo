import type { CmsMailConfig, CmsMailMessage } from '../utils/cmsMail'

// Edge (Workers) mail transport. SMTP needs raw TCP and the file transport needs a
// disk, so only `log` is available here today; an HTTP provider (Postmark, Resend,
// Cloudflare Email) is the follow-up for edge deployments.
export async function deliverMail(msg: CmsMailMessage, cfg: CmsMailConfig): Promise<void> {
  if (cfg.transport !== 'log') {
    throw new Error(`[cms] mail transport "${cfg.transport}" is not available on the edge runtime`)
  }
  // In production the body stays out of the logs: it holds one-time sign-in links,
  // and logs are read by more people (and systems) than the inbox is.
  if (process.env.NODE_ENV === 'production') {
    console.warn(`[cms] email to ${msg.to} not sent — no mail transport configured (cms.mail.transport is "log"). Subject: ${msg.subject}`)
    return
  }
  console.info(`[cms] email to ${msg.to}: ${msg.subject}\n${msg.text}`)
}
