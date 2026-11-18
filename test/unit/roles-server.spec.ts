import { beforeEach, describe, expect, it } from 'vitest'
import { defineEntity, defineRoles, defineSingleton, eq, f, rolesDefOf, type CmsRolesDef } from 'tinyzoo'
import { join } from 'node:path'

// What a role means to the server (`roleAccess` and its neighbours), without a server: the Nitro
// helpers these files lean on are stood in for. The same rules over HTTP are in test/api/custom-roles.spec.ts;
// what cannot be shown there is an external sign-in, which the test server does not have.

// Loaded by path: these files lean on Nitro's auto-imports, which the root type-check does not know.
const utils = join(import.meta.dirname, '../../packages/cms/server/utils')
const load = (name: string): Promise<any> => import(/* @vite-ignore */ join(utils, name))
const rolesUtil = await load('cmsRoles.ts')
const crud = await load('cmsCrud.ts')

let roles: CmsRolesDef | null = null
let mode: 'builtin' | 'external' = 'builtin'
const g = globalThis as any
g.useCms = () => ({ reg: { roles } })
g.cmsAuthMode = () => mode
g.createError = (o: any) => Object.assign(new Error(o.statusMessage), o)
g.requireCmsUser = (event: any) => event.user
for (const [k, v] of Object.entries(rolesUtil)) g[k] = v

const post = defineEntity('post', { label: 'Posts', titleField: 'title', fields: { title: f.text(), status: f.select({ options: ['draft', 'live'] as const, default: 'draft' }) }, content: { public: true }, publish: { field: 'status', publishedValue: 'live', draftValue: 'draft' } }) as any
const tag = defineEntity('tag', { label: 'Tags', titleField: 'name', fields: { name: f.text() }, content: { public: true } }) as any // live the moment it is saved
const note = defineEntity('note', { label: 'Notes', titleField: 'title', fields: { title: f.text() } }) as any // private
const settings = defineSingleton('settings', { label: 'Settings', titleField: 'name', fields: { name: f.text() }, content: { public: true } }) as any

const user = (role: string) => ({ id: '00000000-0000-4000-8000-000000000001', role })
const OPS = ['read', 'create', 'update', 'delete'] as const
const verdict = (e: any, role: string) => Object.fromEntries(OPS.map((op) => {
  const r = crud.roleAccess(e, op, user(role))
  return [op, r.allowed ? (r.where ? 'own' : 'yes') : 'no']
}))

beforeEach(() => { roles = null; mode = 'builtin' })

describe('the built-in roles, with no roles defined', () => {
  it('admin and editor: everything', () => {
    for (const role of ['admin', 'editor']) for (const e of [post, tag, note, settings]) expect(verdict(e, role)).toEqual({ read: 'yes', create: 'yes', update: 'yes', delete: 'yes' })
  })

  it('author: reads everything, writes drafts and only their own, never settings or live content', () => {
    expect(verdict(post, 'author')).toEqual({ read: 'yes', create: 'yes', update: 'own', delete: 'own' })
    expect(verdict(note, 'author')).toEqual({ read: 'yes', create: 'yes', update: 'own', delete: 'own' })
    expect(verdict(tag, 'author')).toEqual({ read: 'yes', create: 'no', update: 'no', delete: 'no' })
    expect(verdict(settings, 'author')).toEqual({ read: 'yes', create: 'no', update: 'no', delete: 'no' })
  })

  it('publishing, media and managing people', () => {
    expect([crud.canPublish(user('admin')), crud.canPublish(user('editor')), crud.canPublish(user('author'))]).toEqual([true, true, false])
    expect([rolesUtil.mediaAccess(user('admin')), rolesUtil.mediaAccess(user('editor')), rolesUtil.mediaAccess(user('author'))]).toEqual(['all', 'all', 'own'])
    expect(crud.requireCmsAdmin({ user: user('admin') }).role).toBe('admin')
    expect(() => crud.requireCmsAdmin({ user: user('editor') })).toThrow()
    expect(() => crud.requireCmsAdmin({ user: user('author') })).toThrow()
  })

  it('an author may change only files they uploaded', () => {
    expect(() => crud.assertMediaOwner(user('author'), { uploadedBy: user('author').id })).not.toThrow()
    expect(() => crud.assertMediaOwner(user('author'), { uploadedBy: 'someone-else' })).toThrow(/only change files you uploaded/)
    expect(() => crud.assertMediaOwner(user('editor'), { uploadedBy: 'someone-else' })).not.toThrow()
  })

  it('a name the site does not have gets nothing with the built-in sign-in (it fails closed)', () => {
    for (const e of [post, tag, note, settings]) expect(verdict(e, 'staff')).toEqual({ read: 'no', create: 'no', update: 'no', delete: 'no' })
    expect(crud.canPublish(user('staff'))).toBe(false)
    expect(rolesUtil.mediaAccess(user('staff'))).toBe('none')
    expect(() => crud.requireCmsAdmin({ user: user('staff') })).toThrow()
    expect(() => crud.assertMediaOwner(user('staff'), { uploadedBy: user('staff').id })).toThrow(/cannot use the media library/)
  })

  it('the entity\'s own `access` rule still narrows it, and sees the built-in a role is (`user.base`)', () => {
    let seen: any
    const guarded = { ...post, access: { read: ({ user }: any) => { seen = user; return user.base !== 'author' } } }
    expect(crud.accessWhere(guarded, 'read', user('editor') as any).allowed).toBe(true)
    expect(seen).toMatchObject({ role: 'editor', base: 'editor' })
    expect(crud.accessWhere(guarded, 'read', user('author') as any).allowed).toBe(false)
  })
})

describe('an external sign-in', () => {
  it('on a site with no roles defined, a name the site does not know acts as before: every collection, the entities\' own rules decide', () => {
    mode = 'external'
    expect(verdict(post, 'staff')).toEqual({ read: 'yes', create: 'yes', update: 'yes', delete: 'yes' })
    expect(verdict(settings, 'staff')).toEqual({ read: 'yes', create: 'yes', update: 'yes', delete: 'yes' })
    expect(crud.canPublish(user('staff'))).toBe(true)
    expect(rolesUtil.mediaAccess(user('staff'))).toBe('all')
    // …but is never an administrator.
    expect(() => crud.requireCmsAdmin({ user: user('staff') })).toThrow()
    // The built-in names mean what they mean.
    expect(verdict(tag, 'author')).toEqual({ read: 'yes', create: 'no', update: 'no', delete: 'no' })
  })

  it('on a site that defines roles, every name must be known: the provider\'s names map onto the definitions, and an unknown one fails closed', () => {
    mode = 'external'
    roles = rolesDefOf(defineRoles({ translator: { from: 'editor', entities: { post: ['read', 'update'] }, publish: false } }))
    expect(verdict(post, 'translator')).toEqual({ read: 'yes', create: 'no', update: 'yes', delete: 'no' })
    expect(crud.canPublish(user('translator'))).toBe(false)
    expect(verdict(post, 'staff')).toEqual({ read: 'no', create: 'no', update: 'no', delete: 'no' })
    expect(crud.canPublish(user('staff'))).toBe(false)
    expect(rolesUtil.mediaAccess(user('staff'))).toBe('none')
    expect(verdict(post, 'editor')).toEqual({ read: 'yes', create: 'yes', update: 'yes', delete: 'yes' })
  })
})

describe('a role the site defines', () => {
  beforeEach(() => {
    roles = rolesDefOf(defineRoles({
      translator: { from: 'editor', entities: { post: ['read', 'update'], note: [] }, publish: false, media: 'own' },
      proofreader: { from: 'editor', entities: { post: ['read', 'update'] } },
      trainee: { from: 'author', entities: { settings: ['read', 'update'], post: ['read', 'create', 'update', 'delete'] }, publish: true },
      intern: { from: 'author' },
    }))
  })

  it('a listed collection gets exactly the operations listed; one that is not listed is what the role extends', () => {
    expect(verdict(post, 'translator')).toEqual({ read: 'yes', create: 'no', update: 'yes', delete: 'no' })
    expect(verdict(note, 'translator')).toEqual({ read: 'no', create: 'no', update: 'no', delete: 'no' }) // [] = not seen
    // An editor may change a private collection and read the rest; this one may not publish, so what is live on save is closed.
    expect(verdict(tag, 'translator')).toEqual({ read: 'yes', create: 'no', update: 'no', delete: 'no' })
    expect(verdict(settings, 'translator')).toEqual({ read: 'yes', create: 'no', update: 'no', delete: 'no' })
    // With publishing, an editor-based role changes any entry; the listed collection is narrowed.
    expect(verdict(post, 'proofreader')).toEqual({ read: 'yes', create: 'no', update: 'yes', delete: 'no' })
    expect(verdict(tag, 'proofreader')).toEqual({ read: 'yes', create: 'yes', update: 'yes', delete: 'yes' })
  })

  it('a role built on author keeps "own entries only"; a grant on a global has no owner to ask', () => {
    expect(verdict(post, 'trainee')).toEqual({ read: 'yes', create: 'yes', update: 'own', delete: 'own' })
    expect(verdict(settings, 'trainee')).toEqual({ read: 'yes', create: 'no', update: 'yes', delete: 'no' })
    // Not listed: what an author has, settings closed, and no publishing.
    expect(verdict(settings, 'intern')).toEqual({ read: 'yes', create: 'no', update: 'no', delete: 'no' })
    expect(verdict(post, 'intern')).toEqual({ read: 'yes', create: 'yes', update: 'own', delete: 'own' })
    expect(verdict(tag, 'intern')).toEqual({ read: 'yes', create: 'no', update: 'no', delete: 'no' })
    // `publish: true` lifts the closed live collections for a role that is listed on them (and extends author: own entries).
    expect(crud.canPublish(user('trainee'))).toBe(true)
    expect(crud.canPublish(user('intern'))).toBe(false)
  })

  it('publishing and media come from the definition, else from what the role extends', () => {
    expect(crud.canPublish(user('translator'))).toBe(false)
    expect(crud.canPublish(user('proofreader'))).toBe(true)
    expect([rolesUtil.mediaAccess(user('translator')), rolesUtil.mediaAccess(user('proofreader')), rolesUtil.mediaAccess(user('trainee')), rolesUtil.mediaAccess(user('intern'))]).toEqual(['own', 'all', 'own', 'own'])
  })

  it('never manages people', () => {
    for (const role of ['translator', 'proofreader', 'trainee', 'intern']) expect(() => crud.requireCmsAdmin({ user: user(role) })).toThrow(/Administrators only/)
  })

  it('assigns the built-ins and its own names, and no other', () => {
    expect(rolesUtil.assignableRoles()).toEqual(['admin', 'editor', 'author', 'translator', 'proofreader', 'trainee', 'intern'])
    expect(rolesUtil.assignableRoleSchema().safeParse('translator').success).toBe(true)
    expect(rolesUtil.assignableRoleSchema().safeParse('ghost').success).toBe(false)
    expect(rolesUtil.assignableRoleSchema().safeParse('__proto__').success).toBe(false)
  })
})

describe('field access on the server', () => {
  const entity = defineEntity('person', {
    label: 'People', titleField: 'name',
    fields: {
      name: f.text(),
      email: f.text().access({ read: ['editor'], edit: ['editor'] }),
      note: f.text().optional().access({ edit: ['editor'] }),
      hero: f.media().optional().access({ read: ['editor'] }),
    },
  }) as any
  const row = () => ({ id: 'x', name: 'N', email: 'e', note: 'n', heroId: 'h', hero: 'h', hero__media: { id: 'h' }, hero__label: 'l', __defaults: { email: 'd', note: 'd2' } })

  it('lists what a role cannot read and what it cannot edit', () => {
    expect([...rolesUtil.unreadableFields(entity, user('author'))].sort()).toEqual(['email', 'hero'])
    expect([...rolesUtil.uneditableFields(entity, user('author'))].sort()).toEqual(['email', 'hero', 'note'])
    expect([...rolesUtil.uneditableFields(entity, user('editor'))]).toEqual([])
    expect([...rolesUtil.uneditableFields(entity, user('admin'))]).toEqual([])
    // No role at all: every field that has a rule is closed (the entity itself is closed too).
    expect([...rolesUtil.unreadableFields(entity, user('ghost'))].sort()).toEqual(['email', 'hero', 'note'])
  })

  it('strips a field from a row with everything the form attached to it', () => {
    const r = rolesUtil.stripUnreadable(entity, user('author'), row())
    expect(r).toEqual({ id: 'x', name: 'N', note: 'n', __defaults: { note: 'd2' } })
    expect(rolesUtil.stripUnreadable(entity, user('editor'), row())).toEqual(row())
    expect(rolesUtil.stripUnreadable(entity, user('author'), null)).toBeNull()
    // An entity with no rules is passed through untouched.
    const plain = { id: '1', title: 'x' }
    expect(rolesUtil.stripUnreadable(note, user('author'), plain)).toBe(plain)
  })

  it('refuses a write that names a field it may not edit, and says which — only fields count', () => {
    expect(() => rolesUtil.assertFieldsEditable(entity, user('author'), ['name', 'note'])).toThrow(/this field: note/)
    try { rolesUtil.assertFieldsEditable(entity, user('author'), ['email', 'hero', 'name']) }
    catch (e: any) { expect(e).toMatchObject({ statusCode: 403, data: { code: 'field_forbidden', fields: ['email', 'hero'] } }) }
    expect(() => rolesUtil.assertFieldsEditable(entity, user('author'), ['name', 'unknownKey', 'constructor'])).not.toThrow()
    expect(() => rolesUtil.assertFieldsEditable(entity, user('editor'), ['email', 'note', 'hero'])).not.toThrow()
    expect(() => rolesUtil.assertFieldsEditable(entity, user('admin'), ['email'])).not.toThrow()
    expect(rolesUtil.bodyKeys({ a: 1 })).toEqual(['a'])
    expect(rolesUtil.bodyKeys(null)).toEqual([])
    expect(rolesUtil.bodyKeys([1])).toEqual([])
  })

  it('the foreign key column of a relation follows its field', () => {
    void eq // (the drizzle helpers are the real ones: the rule is only about keys)
    expect(rolesUtil.stripUnreadable(entity, user('author'), { heroId: 'h', name: 'n' })).toEqual({ name: 'n' })
  })
})

describe('an external sign-in on a site without defineRoles', () => {
  it('gives a role name the site does not know no `base`, so the forms\' default rule does not take it for an editor', async () => {
    const { formsReadAccess } = await import('tinyzoo/forms')
    mode = 'external'
    const inbox = defineEntity('inbox', { label: 'Inbox', titleField: 'title', fields: { title: f.text() }, access: { read: formsReadAccess } }) as any
    expect(crud.accessWhere(inbox, 'read', user('member')).allowed).toBe(false)
    expect(crud.accessWhere(inbox, 'read', user('editor')).allowed).toBe(true)
    let seen: any
    const spy = defineEntity('spy', { label: 'Spy', titleField: 'title', fields: { title: f.text() }, access: { read: ({ user }: any) => { seen = user.base; return true } } }) as any
    expect(crud.accessWhere(spy, 'read', user('member')).allowed).toBe(true) // the entity rules decide, as before roles existed
    expect(seen).toBeNull()
  })
})
