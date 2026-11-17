import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { createServer, type AddressInfo, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deliverMail } from '../../packages/cms/server/mail/mailer'

// An invitation says "sent" only when the mail transport really sent it; with the
// "log" transport (nothing configured) the link has to be passed on by hand.
const msg = { to: 'a@example.test', subject: 'Hi', text: 'text', html: '<p>text</p>' }
const cfg = (transport: 'smtp' | 'file' | 'log', dir = '.cms-mail') => ({ transport, from: 'CMS <x@example.test>', smtp: { host: '', port: 587, secure: false, user: '', pass: '' }, file: { dir } })
const dirs: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true })
})

describe('did the mail really go out', () => {
  it('says no for the log transport, which only writes the message to the log', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    expect(await deliverMail(msg, cfg('log'))).toBe(false)
    expect(info).toHaveBeenCalled()
  })

  it('says yes when it was written out by the file transport', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cms-mail-'))
    dirs.push(dir)
    expect(await deliverMail(msg, cfg('file', dir))).toBe(true)
    expect(await readdir(dir)).toHaveLength(1)
  })
})

/**
 * A few lines of SMTP, enough for nodemailer to deliver one message (no TLS): what the
 * smtp transport says on the wire, with the options tinyzoo gives it.
 */
async function fakeSmtp(opts: { auth?: boolean } = {}) {
  const got: { auth?: string; from?: string; to: string[]; data?: string }[] = []
  const server: Server = createServer((socket) => {
    const mail: (typeof got)[number] = { to: [] }
    let inData = false
    let buf = ''
    socket.write('220 fake ESMTP\r\n')
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8')
      if (inData) {
        const end = buf.indexOf('\r\n.\r\n')
        if (end < 0) return
        mail.data = buf.slice(0, end)
        buf = buf.slice(end + 5)
        inData = false
        got.push({ ...mail })
        socket.write('250 queued\r\n')
      }
      let nl
      while (!inData && (nl = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 2)
        const cmd = line.slice(0, 4).toUpperCase()
        if (cmd === 'EHLO') socket.write(`250-fake\r\n${opts.auth ? '250-AUTH PLAIN\r\n' : ''}250 8BITMIME\r\n`)
        else if (cmd === 'AUTH') { mail.auth = Buffer.from(line.split(' ')[2] ?? '', 'base64').toString('utf8'); socket.write('235 ok\r\n') }
        else if (cmd === 'MAIL') { mail.from = line; socket.write('250 ok\r\n') }
        else if (cmd === 'RCPT') { mail.to.push(line); socket.write('250 ok\r\n') }
        else if (cmd === 'DATA') { inData = true; socket.write('354 go on\r\n') }
        else if (cmd === 'QUIT') { socket.end('221 bye\r\n') }
        else if (cmd === 'RSET' || cmd === 'NOOP') socket.write('250 ok\r\n')
        else socket.write('502 not here\r\n')
      }
    })
    socket.on('error', () => {})
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  return { got, port: (server.address() as AddressInfo).port, close: () => new Promise<void>((r) => server.close(() => r())) }
}

describe('the smtp transport (nodemailer)', () => {
  it('delivers the message with its subject, both bodies and the reply address', async () => {
    const smtp = await fakeSmtp()
    try {
      const config = { ...cfg('smtp'), smtp: { host: '127.0.0.1', port: String(smtp.port), secure: false, user: '', pass: '' } }
      expect(await deliverMail({ ...msg, subject: 'Pozvánka', replyTo: 'r@example.test' }, config)).toBe(true)
      expect(smtp.got).toHaveLength(1)
      const [mail] = smtp.got
      expect(mail!.auth).toBeUndefined()
      expect(mail!.from).toContain('<x@example.test>')
      expect(mail!.to).toEqual(['RCPT TO:<a@example.test>'])
      expect(mail!.data).toMatch(/^Reply-To: r@example\.test\r$/m)
      expect(mail!.data).toMatch(/^Subject: =\?UTF-8\?Q\?Pozv=C3=A1nka\?=\r$/m)
      expect(mail!.data).toContain('text/plain')
      expect(mail!.data).toContain('<p>text</p>')
    }
    finally { await smtp.close() }
  })

  it('signs in when a user is configured', async () => {
    const smtp = await fakeSmtp({ auth: true })
    try {
      const config = { ...cfg('smtp'), smtp: { host: '127.0.0.1', port: smtp.port, secure: false, user: 'mailer', pass: 'secret pass' } }
      expect(await deliverMail(msg, config)).toBe(true)
      expect(smtp.got[0]!.auth).toBe('\u0000mailer\u0000secret pass')
    }
    finally { await smtp.close() }
  })
})
