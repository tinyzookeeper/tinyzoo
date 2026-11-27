import { describe, expect, it } from 'vitest'
import { defineBlock, f } from '../../packages/cms/src/index'
import { blocksGraph } from '../../packages/cms/src/blocks'
import { blockListKinds, isPlainTextField, textEdit, typingGroup, type BlockList } from '../../packages/cms/shared/block-tree'
import { createBuilderHistory } from '../../packages/cms/shared/builder-history'
import {
  cmsBuilderFieldInfo, cmsBuilderFieldValue, cmsFieldAttrs, cmsFieldOf, cmsTextClip, cmsTextOf, isCmsBuilderToAdmin, isCmsBuilderToPage, isCmsFieldName,
  type CmsTextNode,
} from '../../packages/cms/shared/builder'

// Part 2d of the builder: typing in the page. The address of a marked field, reading a plain text out of
// an element (line breaks, paragraphs, the maximum), the value a text starts from, what the page knows of
// a block's fields, the change a typed text makes, its messages, and that typing in the page is one step
// of the history per field per pause, as typing in the form is.

const heading = defineBlock({ label: 'Heading', fields: { text: f.text({ max: 12 }), level: f.select({ options: ['large', 'small'] }).setting() } })
const text = defineBlock({ label: 'Text', fields: { body: f.richtext() } })
const layout = defineBlock({ label: 'Layout', fields: { items: f.blocks({ heading, text }, { max: 4 }) } })
const cards = defineBlock({
  label: 'Cards',
  fields: {
    heading: f.text(),
    intro: f.text({ multiline: true }),
    link: f.text({ format: 'link' }),
    image: f.media({ accept: 'image/*' }).optional(),
    items: f.list({ fields: { title: f.text({ required: true, max: 20 }), text: f.text({ multiline: true }) } }),
  },
})
const defs = blocksGraph({ cards, layout }) as any
const page = () => [
  { id: 'C', type: 'cards', heading: 'Cards', intro: null, link: null, image: null, items: [{ id: 'c1', type: 'item', title: 'One', text: 'First' }, { id: 'c2', type: 'item', title: 'Two', text: null }] },
  { id: 'L', type: 'layout', items: [{ id: 'h', type: 'heading', text: 'Hello', level: 'large' }, { id: 't', type: 'text', body: null }] },
]
const root = (items: any[] = page()): BlockList => ({ items, defs, max: null })

/** A tiny DOM: text, elements with children and attributes. */
const t = (value: string): CmsTextNode => ({ nodeType: 3, nodeName: '#text', nodeValue: value, childNodes: [] })
const e = (name: string, children: CmsTextNode[] = [], attrs: Record<string, string> = {}): CmsTextNode => ({
  nodeType: 1, nodeName: name.toUpperCase(), nodeValue: null, childNodes: children, getAttribute: (n) => attrs[n] ?? null,
})

describe('a marked field: its address', () => {
  it('is a field name, and an item id for a field of an item of the block\'s own list', () => {
    expect(cmsFieldAttrs('heading')).toEqual({ 'data-cms-field': 'heading' })
    expect(cmsFieldAttrs('title', 'c1')).toEqual({ 'data-cms-field': 'title', 'data-cms-item': 'c1' })
    expect(cmsFieldAttrs('title', null)).toEqual({ 'data-cms-field': 'title' })
    expect(cmsFieldAttrs('title', '')).toEqual({ 'data-cms-field': 'title' })
    for (const bad of ['', '1x', 'a b', 'a.b', 'a-b', 'x'.repeat(65)]) expect(cmsFieldAttrs(bad)).toEqual({})
    expect(isCmsFieldName('buttonLabel')).toBe(true)
  })

  it('is read back from an element', () => {
    const el = (attrs: Record<string, string>) => ({ getAttribute: (n: string) => attrs[n] ?? null })
    expect(cmsFieldOf(el(cmsFieldAttrs('title', 'c1')))).toEqual({ field: 'title', item: 'c1' })
    expect(cmsFieldOf(el(cmsFieldAttrs('heading')))).toEqual({ field: 'heading', item: null })
    expect(cmsFieldOf(el({}))).toBeNull()
    expect(cmsFieldOf(el({ 'data-cms-field': 'a b' }))).toBeNull()
  })
})

describe('reading a plain text out of an element', () => {
  it('reads its text, never its HTML', () => {
    expect(cmsTextOf(e('h2', [t('Hello '), e('em', [t('world')]), t('!')]), { lines: false })).toBe('Hello world!')
    expect(cmsTextOf(e('h2', [t('<b>not bold</b>')]), { lines: false })).toBe('<b>not bold</b>')
  })

  it('makes a <br> a line break, but not the browser\'s own last one', () => {
    expect(cmsTextOf(e('p', [t('one'), e('br'), t('two')]), { lines: true })).toBe('one\ntwo')
    expect(cmsTextOf(e('p', [t('one'), e('br'), e('br'), t('three')]), { lines: true })).toBe('one\n\nthree')
    expect(cmsTextOf(e('p', [t('one'), e('br')]), { lines: true })).toBe('one')
    expect(cmsTextOf(e('p', [t('one'), e('br'), e('br')]), { lines: true })).toBe('one\n')
    expect(cmsTextOf(e('p', [e('br')]), { lines: true })).toBe('')
  })

  it('makes paragraphs a blank line and other blocks a line break', () => {
    expect(cmsTextOf(e('div', [e('p', [t('One.')]), e('p', [t('Two.')])]), { lines: true })).toBe('One.\n\nTwo.')
    expect(cmsTextOf(e('div', [t('a'), e('div', [t('b')]), e('div', [t('c'), e('br')])]), { lines: true })).toBe('a\nb\nc')
    expect(cmsTextOf(e('div', [e('p', [t('One'), e('br'), t('line')]), e('p', [t('Two')])]), { lines: true })).toBe('One\nline\n\nTwo')
  })

  it('leaves out a decoration kept beside the text', () => {
    expect(cmsTextOf(e('h2', [e('span', [t('/')], { contenteditable: 'false' }), t('Heading')]), { lines: false })).toBe('Heading')
  })

  it('keeps one line in a field of one line', () => {
    expect(cmsTextOf(e('h2', [t('one'), e('br'), t('two')]), { lines: false })).toBe('one two')
    expect(cmsTextClip('a\r\nb\n\nc', { lines: false })).toBe('a b c')
    expect(cmsTextClip('a\r\nb', { lines: true })).toBe('a\nb')
  })

  it('keeps the field\'s maximum, and never cuts a pair of surrogates in two', () => {
    expect(cmsTextOf(e('h2', [t('Příliš žluťoučký kůň')]), { lines: false, max: 6 })).toBe('Příliš')
    expect(cmsTextClip('ab😀c', { lines: false, max: 3 })).toBe('ab')
    expect(cmsTextClip('ab😀c', { lines: false, max: 4 })).toBe('ab😀')
    expect(cmsTextClip('short', { lines: false, max: 10 })).toBe('short')
  })

  it('keeps Czech letters and non-breaking spaces as they are', () => {
    expect(cmsTextOf(e('h2', [t('Čeština v Praze')]), { lines: false })).toBe('Čeština v Praze')
  })
})

describe('the value a text starts from, and what the page knows of a field', () => {
  const data = { title: 'Home', sections: page() }

  it('finds a field of a block at any depth, and of an item of its list', () => {
    expect(cmsBuilderFieldValue(data, ['L', 'h'], 'text')).toBe('Hello')
    expect(cmsBuilderFieldValue(data, ['C'], 'heading')).toBe('Cards')
    expect(cmsBuilderFieldValue(data, ['C'], 'intro')).toBeNull()
    expect(cmsBuilderFieldValue(data, ['C'], 'title', 'c2')).toBe('Two')
    expect(cmsBuilderFieldValue(data, ['C'], 'text', 'c2')).toBeNull()
    expect(cmsBuilderFieldValue(data, ['C'], 'missing')).toBeUndefined()
    expect(cmsBuilderFieldValue(data, ['X'], 'heading')).toBeUndefined()
    expect(cmsBuilderFieldValue(data, ['C'], 'title', 'c9')).toBeUndefined()
    expect(cmsBuilderFieldValue(undefined, ['C'], 'heading')).toBeUndefined()
  })

  it('gets each block\'s fields with its kind: plain texts with their lines and maximum, the others without', () => {
    const kinds = blockListKinds({ defs, max: null }, (d: any) => d.label)
    const fields = kinds.types.cards!.fields!
    expect(fields.heading).toEqual({ text: 'line' })
    expect(fields.intro).toEqual({ text: 'lines' })
    expect(fields.link).toEqual({})
    expect(fields.image).toEqual({})
    expect(fields.items).toEqual({ items: { title: { text: 'line', max: 20 }, text: { text: 'lines' } } })
    expect(kinds.types.layout!.list!.types.heading!.fields).toEqual({ text: { text: 'line', max: 12 }, level: {} })
    expect(kinds.types.layout!.list!.types.text!.fields).toEqual({ body: {} })
    expect(cmsBuilderFieldInfo(kinds.types.cards, 'title', 'c1')).toEqual({ text: 'line', max: 20 })
    expect(cmsBuilderFieldInfo(kinds.types.cards, 'heading', null)).toEqual({ text: 'line' })
    expect(cmsBuilderFieldInfo(kinds.types.cards, 'nothing', null)).toBeNull()
    expect(cmsBuilderFieldInfo(null, 'heading', null)).toBeNull()
    // The page accepts the kinds with their fields.
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts: { drag: '', moveUp: '', moveDown: '', duplicate: '', remove: '', insertHere: '' }, selected: null, lists: kinds })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts: { drag: '', moveUp: '', moveDown: '', duplicate: '', remove: '', insertHere: '' }, selected: null, lists: { types: { a: { label: 'A', sig: 's', fields: { x: { text: 'bold' } } } }, max: null } })).toBe(false)
  })

  it('calls a text with a format, or a setting, no plain text', () => {
    expect(isPlainTextField({ key: 'a', type: 'text', meta: {} })).toBe(true)
    expect(isPlainTextField({ key: 'a', type: 'text', meta: { format: 'link' } })).toBe(false)
    expect(isPlainTextField({ key: 'a', type: 'text', meta: { setting: true } })).toBe(false)
    expect(isPlainTextField({ key: 'a', type: 'richtext' })).toBe(false)
  })
})

describe('the change a text typed in the page makes', () => {
  it('sets a plain text of a block at any depth, clipped to its maximum', () => {
    expect(textEdit(root(), ['C'], 'heading', null, 'New')).toEqual({ key: 'heading', value: 'New' })
    expect(textEdit(root(), ['L', 'h'], 'text', null, 'A long heading here')).toEqual({ key: 'text', value: 'A long headi' })
    expect(textEdit(root(), ['C'], 'heading', null, 'one\ntwo')).toEqual({ key: 'heading', value: 'one two' })
    expect(textEdit(root(), ['C'], 'intro', null, 'one\ntwo')).toEqual({ key: 'intro', value: 'one\ntwo' })
  })

  it('sets a field of an item of the block\'s own list, the other items as they were', () => {
    const edit = textEdit(root(), ['C'], 'title', 'c2', 'Second')
    expect(edit?.key).toBe('items')
    expect(edit?.value).toEqual([{ id: 'c1', type: 'item', title: 'One', text: 'First' }, { id: 'c2', type: 'item', title: 'Second', text: null }])
  })

  it('changes nothing that is not a plain text, nor what is not there', () => {
    expect(textEdit(root(), ['C'], 'link', null, '/x')).toBeNull()
    expect(textEdit(root(), ['C'], 'image', null, 'x')).toBeNull()
    expect(textEdit(root(), ['L', 'h'], 'level', null, 'small')).toBeNull()
    expect(textEdit(root(), ['L', 't'], 'body', null, 'x')).toBeNull()
    expect(textEdit(root(), ['C'], 'title', 'c9', 'x')).toBeNull()
    expect(textEdit(root(), ['X'], 'heading', null, 'x')).toBeNull()
    expect(textEdit(root(), ['C'], 'id', null, 'x')).toBeNull()
  })
})

describe('typing in the page: its messages and the history', () => {
  it('sends a text and a field as the admin accepts them', () => {
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:text', id: 'h', path: ['L', 'h'], field: 'text', value: 'Hi' })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:text', id: 'C', field: 'title', item: 'c1', value: 'X', end: true })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:text', id: 'h', path: ['L', 'x'], field: 'text', value: 'Hi' })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:text', id: 'h', field: 'te xt', value: 'Hi' })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:text', id: 'h', field: 'text', value: 5 })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:text', id: 'h', field: 'text', value: 'x'.repeat(100_001) })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:field', id: 't', path: ['L', 't'], field: 'body' })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:field', id: 't', field: 'image', open: true })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:field', id: 't', field: 'image', open: 'yes' })).toBe(false)
  })

  it('is one step per field per pause, as typing in the form is', () => {
    const history = createBuilderHistory<any[]>()
    let value = page()
    const type = (path: string[], field: string, item: string | null, typed: string, now: number) => {
      const edit = textEdit(root(value), path, field, item, typed)!
      const found = path.length === 1 ? value.findIndex((b) => b.id === path[0]) : -1
      const next = path.length === 1
        ? value.map((b, i) => (i === found ? { ...b, [edit.key]: edit.value } : b))
        : value.map((b) => (b.id === path[0] ? { ...b, items: b.items.map((x: any) => (x.id === path[1] ? { ...x, [edit.key]: edit.value } : x)) } : b))
      history.record(value, next, { group: typingGroup(defs, value, next), now })
      value = next
    }
    // A word typed in the heading of a small block, key by key: one step.
    type(['L', 'h'], 'text', null, 'Hello w', 1000)
    type(['L', 'h'], 'text', null, 'Hello wo', 1200)
    type(['L', 'h'], 'text', null, 'Hello wor', 1400)
    expect(history.size).toBe(1)
    // After a pause, a new step.
    type(['L', 'h'], 'text', null, 'Hello worl', 3000)
    expect(history.size).toBe(2)
    // Another field: a new step, even without a pause.
    type(['C'], 'heading', null, 'Cards!', 3100)
    expect(history.size).toBe(3)
    // A card's title, key by key: one step.
    type(['C'], 'title', 'c1', 'One!', 3200)
    type(['C'], 'title', 'c1', 'One!!', 3300)
    expect(history.size).toBe(4)
    // Undo takes the card's title back to before it was typed.
    const step = history.undo()!
    expect(step.before.find((b: any) => b.id === 'C').items[0].title).toBe('One')
  })
})
