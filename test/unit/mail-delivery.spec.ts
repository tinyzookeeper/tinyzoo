import { mkdtemp, readdir, rm } from 'node:fs/promises'
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
