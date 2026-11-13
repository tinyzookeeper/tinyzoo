import type { CmsMailConfig, CmsMailMessage } from '../utils/cmsMail'

// Node mail transports: smtp (nodemailer), file (one JSON file per email — for tests
// and for looking at emails locally without a mail server) and log (stdout).

let transporter: any
let transporterKey = ''

export async function deliverMail(msg: CmsMailMessage, cfg: CmsMailConfig): Promise<void> {
  if (cfg.transport === 'smtp') {
    const key = JSON.stringify(cfg.smtp)
    if (!transporter || key !== transporterKey) {
      const nodemailer = await import('nodemailer')
      transporter = nodemailer.createTransport({
        host: cfg.smtp.host,
        port: Number(cfg.smtp.port) || 587,
        secure: !!cfg.smtp.secure,
        auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.pass } : undefined,
      })
      transporterKey = key
    }
    await transporter.sendMail({ from: cfg.from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html })
    return
  }
  if (cfg.transport === 'file') {
    const { mkdir, writeFile } = await import('node:fs/promises')
    const { join, resolve } = await import('node:path')
    const dir = resolve(process.cwd(), cfg.file.dir || '.cms-mail')
    await mkdir(dir, { recursive: true })
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}.json`
    await writeFile(join(dir, name), JSON.stringify({ from: cfg.from, ...msg }, null, 2))
    return
  }
  // In production the body stays out of the logs: it holds one-time sign-in links,
  // and logs are read by more people (and systems) than the inbox is.
  if (process.env.NODE_ENV === 'production') {
    console.warn(`[cms] email to ${msg.to} not sent — no mail transport configured (cms.mail.transport is "log"). Subject: ${msg.subject}`)
    return
  }
  console.info(`[cms] email to ${msg.to}: ${msg.subject}\n${msg.text}`)
}
