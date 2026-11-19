import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineRoles, rolesDefOf, type CmsRolesDef } from 'tinyzoo'

// The server helpers for plugins are frozen from 1.0 (docs/api-surface.md, "Server helpers for plugins"):
// their types are in test/contracts/server-helpers.d.ts; what `requireCmsUser(event)` does is here.
// It returns the signed-in user, throws 401 to a visitor who is not signed in, and 403 `role-removed`
// to an account whose role the site no longer has.

// Loaded by path: these files lean on Nitro's auto-imports, which are stood in for below.
const utils = join(import.meta.dirname, '../../packages/cms/server/utils')
const load = (name: string): Promise<any> => import(/* @vite-ignore */ join(utils, name))
const rolesUtil = await load('cmsRoles.ts')
const session = await load('cmsSession.ts')

let roles: CmsRolesDef | null = null
const g = globalThis as any
g.useCms = () => ({ reg: { roles } })
g.cmsAuthMode = () => 'builtin'
g.createError = (o: any) => Object.assign(new Error(o.statusMessage), o)
g.roleOf = rolesUtil.roleOf

const event = (cmsUser?: unknown) => ({ context: cmsUser ? { cmsUser } : {} })
const caught = (fn: () => unknown): any => { try { fn() } catch (e) { return e } throw new Error('did not throw') }

beforeEach(() => { roles = null })

describe('requireCmsUser(event)', () => {
  it('returns the signed-in user as the session has it', () => {
    const user = { id: '00000000-0000-4000-8000-000000000001', email: 'eva@example.com', name: 'Eva', role: 'editor', locale: 'cs' }
    expect(session.requireCmsUser(event(user))).toBe(user)
  })

  it('throws 401 when nobody is signed in', () => {
    expect(caught(() => session.requireCmsUser(event()))).toMatchObject({ statusCode: 401 })
  })

  it('throws 403 role-removed when the account\'s role is no longer in the config', () => {
    roles = rolesDefOf(defineRoles({ reviewer: { from: 'editor' } }))
    expect(session.requireCmsUser(event({ id: 'u1', role: 'reviewer' })).role).toBe('reviewer')
    roles = rolesDefOf(defineRoles({ translator: { from: 'author' } }))
    expect(caught(() => session.requireCmsUser(event({ id: 'u1', role: 'reviewer' })))).toMatchObject({ statusCode: 403, data: { code: 'role-removed', role: 'reviewer' } })
  })
})
