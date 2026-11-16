import { describe, expect, it } from 'vitest'
import { defineForm, defineFormSettings } from '../../packages/cms/forms'
import { f } from '../../packages/cms/src/fields'

// Who may read form messages: administrators and editors by default; the site can widen or narrow it.
const fields = { name: f.text({ required: true }) }
const user = (role: string) => ({ user: { id: 'u1', role }, table: {} })
const read = (e: any, role: string) => e.access.read(user(role))

describe('defineForm access', () => {
  it('lets administrators and editors read messages, and nobody else (authors, other roles)', () => {
    const form = defineForm('contactForm', { label: 'Contact', fields }) as any
    expect(read(form, 'admin')).toBe(true)
    expect(read(form, 'editor')).toBe(true)
    expect(read(form, 'author')).toBe(false)
    expect(read(form, 'staff')).toBe(false)
  })

  it('takes a rule of its own for read, which replaces the default (to widen or narrow)', () => {
    const wide = defineForm('a', { label: 'A', fields, access: { read: () => true } }) as any
    expect(read(wide, 'author')).toBe(true)
    const narrow = defineForm('b', { label: 'B', fields, access: { read: ({ user }) => user.role === 'admin' } }) as any
    expect(read(narrow, 'editor')).toBe(false)
    expect(read(narrow, 'admin')).toBe(true)
  })

  it('keeps other rules (delete) next to the read default', () => {
    const form = defineForm('c', { label: 'C', fields, access: { delete: ({ user }) => user.role === 'admin' } }) as any
    expect(read(form, 'author')).toBe(false)
    expect(form.access.delete(user('editor'))).toBe(false)
  })

  it('protects the recipients in the Forms settings the same way', () => {
    const settings = defineFormSettings() as any
    expect(read(settings, 'editor')).toBe(true)
    expect(read(settings, 'author')).toBe(false)
    expect(read(defineFormSettings({ access: { read: () => true } }), 'author')).toBe(true)
  })
})
