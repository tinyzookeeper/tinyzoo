import type { CmsMailConfig, CmsMailMessage } from '../utils/cmsMail'

// Edge (Workers) mail transport. SMTP needs raw TCP and the file transport needs a
// disk, so only `log` is available here today; an HTTP provider (Postmark, Resend,
// Cloudflare Email) is the follow-up for edge deployments.
export async function deliverMail(msg: CmsMailMessage, cfg: CmsMailConfig): Promise<void> {
  if (cfg.transport !== 'log') {
    throw new Error(`[cms] mail transport "${cfg.transport}" is not available on the edge runtime`)
  }
  console.info(`[cms] email to ${msg.to}: ${msg.subject}\n${msg.text}`)
}
