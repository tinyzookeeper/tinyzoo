import { deliverMail } from '../mail/mailer'

export interface CmsMailMessage { to: string; subject: string; text: string; html: string; /** Where replies go (a form's sender). */ replyTo?: string }
export interface CmsMailConfig {
  transport: 'smtp' | 'file' | 'log'
  from: string
  smtp: { host: string; port: number | string; secure: boolean; user: string; pass: string }
  file: { dir: string }
}

export function cmsMailConfig(): CmsMailConfig {
  const m = ((useRuntimeConfig().cms as any)?.mail ?? {}) as Partial<CmsMailConfig>
  return {
    transport: (m.transport as CmsMailConfig['transport']) || 'log',
    from: m.from || 'CMS <no-reply@localhost>',
    smtp: { host: '', port: 587, secure: false, user: '', pass: '', ...(m.smtp ?? {}) },
    file: { dir: '.cms-mail', ...(m.file ?? {}) },
  }
}

/** Send an email through the configured transport. Throws on failure (callers decide). */
export async function sendCmsMail(msg: CmsMailMessage): Promise<void> {
  await deliverMail(msg, cmsMailConfig())
}
