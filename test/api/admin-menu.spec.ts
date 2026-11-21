import { afterAll, describe, expect, it } from 'vitest'
import { anonymous, signIn } from '../helpers/api'

// The admin's menu (GET /api/cms/_menu): the playground's defineAdminMenu, what a role opens,
// and an administrator's arrangement for the whole site (PUT, DELETE).
const keysOf = (m: any): string[] => [...m.home, ...m.groups.flatMap((g: any) => g.items), ...m.settings]

describe('the admin menu', () => {
  afterAll(async () => { await (await signIn('admin')).delete('/api/cms/_menu') })

  it('needs a signed-in person', async () => {
    expect((await anonymous().get('/api/cms/_menu')).status).toBe(401)
  })

  it('is laid out as the site says, with the rest in its usual place', async () => {
    const admin = await signIn('admin')
    await admin.delete('/api/cms/_menu')
    const { body, status } = await admin.get('/api/cms/_menu')
    expect(status).toBe(200)
    expect(body.customized).toBe(false)
    // the playground's defineAdminMenu: content: [Post, Author, Tag], website: [Page, Navigation, SiteSettings, '@media']
    const content = body.groups.find((g: any) => g.id === 'content').items
    expect(content.slice(0, 3)).toEqual(['post', 'author', 'tag'])
    expect(body.groups.find((g: any) => g.id === 'website').items).toEqual(['page', 'navigation', 'siteSettings', '@media'])
    // forms are one row beside Home, never rows of their own; redirects and the team are behind Settings
    expect(body.home[0]).toBe('@forms')
    expect(body.forms).toContain('contactForm')
    expect(keysOf(body)).not.toContain('contactForm')
    expect(body.settings).toEqual(expect.arrayContaining(['redirect', '@team', '@privacy', '@about']))
    expect(new Set(keysOf(body)).size).toBe(keysOf(body).length)
  })

  it('leaves out what a role does not open', async () => {
    const author = (await (await signIn('author')).get('/api/cms/_menu')).body
    expect(keysOf(author)).not.toContain('@team')
    expect(keysOf(author)).not.toContain('@privacy')
    expect(keysOf(author)).toContain('@about')
  })

  it('lets an administrator arrange it for everyone, and put it back', async () => {
    const admin = await signIn('admin')
    const before = (await admin.get('/api/cms/_menu')).body
    const groups = Object.fromEntries(before.groups.map((g: any) => [g.id, g.items.filter((k: string) => k !== 'tag' && k !== '@media')]))
    const arranged = await admin.put('/api/cms/_menu', { home: ['tag', ...before.home], groups, settings: ['@media', ...before.settings] })
    expect(arranged.status).toBe(200)
    expect(arranged.body.customized).toBe(true)
    expect(arranged.body.home[0]).toBe('tag')
    expect(arranged.body.settings[0]).toBe('@media')

    // everyone gets it
    const editor = (await (await signIn('editor')).get('/api/cms/_menu')).body
    expect(editor.home[0]).toBe('tag')
    expect(editor.customized).toBe(true)

    const reset = await admin.delete('/api/cms/_menu')
    expect(reset.body.customized).toBe(false)
    expect(reset.body).toEqual(before)
  })

  it('keeps a row the arrangement does not mention where the site has it', async () => {
    const admin = await signIn('admin')
    const before = (await admin.get('/api/cms/_menu')).body
    const partial = await admin.put('/api/cms/_menu', { home: [], groups: { content: ['tag'] }, settings: [] })
    expect(partial.body.groups.find((g: any) => g.id === 'content').items[0]).toBe('tag')
    expect([...keysOf(partial.body)].sort()).toEqual([...keysOf(before)].sort())
    await admin.delete('/api/cms/_menu')
  })

  it('is for administrators to arrange, and refuses rows the site does not have', async () => {
    const body = { home: [], groups: {}, settings: [] }
    expect((await (await signIn('editor')).put('/api/cms/_menu', body)).status).toBe(403)
    expect((await (await signIn('editor')).delete('/api/cms/_menu')).status).toBe(403)
    const admin = await signIn('admin')
    expect((await admin.put('/api/cms/_menu', { ...body, home: ['nothing'] })).status).toBe(422)
    expect((await admin.put('/api/cms/_menu', { home: 'x' })).status).toBe(422)
  })
})
