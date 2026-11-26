import { describe, expect, it } from 'vitest'
import { defineBlock, f } from '../../packages/cms/src/index'
import { blocksGraph } from '../../packages/cms/src/blocks'
import { blockListKinds } from '../../packages/cms/shared/block-tree'
import { isCmsBuilderToPage, type CmsBuilderField } from '../../packages/cms/shared/builder'
import {
  cmsMatchAt, cmsMatchChain, cmsMatchElements, cmsMatchFields, cmsMatchInText, cmsMatchOffset, cmsMatchPictureOf, cmsMatchPictures, cmsMatchReport,
  cmsMatchShown, cmsMatchSquash, cmsMatchUnmarked, cmsMatchValue, cmsRichPlain, cmsSrcsetUrls,
  type CmsMatchNode,
} from '../../packages/cms/shared/builder-match'

// Part 2e of the builder: a text a site's own block does not mark is found by itself. The normal form of
// a value and of a page's text, a block's texts and pictures from its values, the walk from the clicked
// element up to the block, the order as a tiebreak only when it is safe, switching off, the cursor's
// place in a raw value, and the report the measuring script reads.

/** A tiny DOM with parents: text, elements with children and attributes. */
type N = CmsMatchNode & { name: string }
const t = (value: string): N => ({ nodeType: 3, nodeName: '#text', name: '#text', nodeValue: value, childNodes: [], parentNode: null })
function e(name: string, children: N[] = [], attrs: Record<string, string> = {}): N {
  const el: N = { nodeType: 1, nodeName: name.toUpperCase(), name, nodeValue: null, childNodes: children, parentNode: null, getAttribute: (n) => attrs[n] ?? null }
  for (const c of children) c.parentNode = el
  return el
}
const textOf = (value: string, info: CmsBuilderField = { text: 'line' }) => ({ heading: info })

describe('the normal form', () => {
  it('collapses white space, reads odd spaces as spaces and drops invisible characters', () => {
    expect(cmsMatchSquash('  a \n\t b  ')).toBe('a b')
    expect(cmsMatchSquash('k lesu 19 900 Kč')).toBe('k lesu 19 900 Kč')
    expect(cmsMatchSquash('roz­dělit​')).toBe('rozdělit')
  })

  it('takes the look\'s asterisks out of a value', () => {
    expect(cmsMatchValue('Péče o *vaše zdraví*')).toBe('Péče o vaše zdraví')
    expect(cmsMatchValue('*Jedna* a *dvě*')).toBe('Jedna a dvě')
    expect(cmsMatchValue('5 * 3')).toBe('5 * 3')
    expect(cmsMatchValue('řádek\ndruhý')).toBe('řádek druhý')
  })

  it('reads an element as a visitor does: a <br> and the edge of a block are spaces, hidden decorations do not count', () => {
    const el = e('div', [e('p', [t('První')]), e('p', [t('druhý'), e('br'), t('řádek')]), e('span', [t('→')], { 'aria-hidden': 'true' }), e('svg', [t('x')])])
    expect(cmsMatchShown(el)).toBe('První druhý řádek')
    // Czech typography of the looks (tidyText): a no-break space after a one-letter word.
    expect(cmsMatchShown(e('h2', [t('Péče o '), e('em', [t('vaše zdraví')])]))).toBe(cmsMatchValue('Péče o *vaše zdraví*'))
  })

  it('reads a rich text\'s plain text', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Jedna ' }, { type: 'text', text: 'tučně', marks: [{ type: 'bold' }] }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Dva' }, { type: 'hardBreak' }, { type: 'text', text: 'tři' }] }] }
    expect(cmsRichPlain(doc)).toBe('Jedna tučně Dva tři')
    expect(cmsRichPlain({ type: 'doc', content: [] })).toBe('')
    expect(cmsRichPlain(null)).toBe('')
  })
})

describe('a block\'s texts and pictures', () => {
  const fields: Record<string, CmsBuilderField> = {
    heading: { text: 'line', max: 80 }, lead: { text: 'lines' }, body: {}, image: {}, level: {},
    steps: { items: { title: { text: 'line' }, photo: {} } },
  }
  const block = {
    id: 'b', type: 'x', heading: 'Ahoj *světe*', lead: '', level: 'large', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tělo' }] }] },
    image: { id: 'm1', url: '/api/cms/_media/m1/a.jpg' },
    steps: [{ id: 's1', type: 'item', title: 'Krok', photo: { id: 'm2', url: '/u/b.jpg' } }, { id: 's2', type: 'item', title: 'Krok' }, { type: 'item', title: 'no id' }],
  }

  it('are the non-empty plain and rich texts, the block\'s own first, then its items in order; a choice is no text', () => {
    expect(cmsMatchFields(block, fields).map((x) => [x.field, x.item, x.list, x.kind, x.norm])).toEqual([
      ['heading', null, null, 'text', 'Ahoj světe'],
      ['body', null, null, 'rich', 'Tělo'],
      ['title', 's1', 'steps', 'text', 'Krok'],
      ['title', 's2', 'steps', 'text', 'Krok'],
    ])
    expect(cmsMatchFields(block, fields)[0]).toMatchObject({ text: 'line', max: 80 })
    expect(cmsMatchFields(block, undefined)).toEqual([])
  })

  it('pictures are found by their address or by their id in a smaller copy\'s', () => {
    const pictures = cmsMatchPictures(block, fields)
    expect(pictures.map((p) => [p.field, p.item])).toEqual([['image', null], ['photo', 's1']])
    expect(cmsMatchPictureOf(['http://site.localhost:3000/api/cms/_media/m1/a.jpg?v=2'], pictures)?.field).toBe('image')
    expect(cmsMatchPictureOf(['/api/cms/_media/img/m1/640.webp'], pictures)?.field).toBe('image')
    expect(cmsMatchPictureOf(['', '/u/b.jpg'], pictures)?.item).toBe('s1')
    expect(cmsMatchPictureOf(['/other.jpg'], pictures)).toBeNull()
    expect(cmsSrcsetUrls('/a/320.webp 320w, /a/x.jpg 1200w')).toEqual(['/a/320.webp', '/a/x.jpg'])
  })

  it('one picture in two items is told apart by order only when there are as many images of it', () => {
    const two = { steps: [{ id: 'a', photo: { id: 'p', url: '/p.jpg' } }, { id: 'b', photo: { id: 'p', url: '/p.jpg' } }] }
    const pictures = cmsMatchPictures(two, { steps: { items: { photo: {} } } })
    expect(cmsMatchPictureOf(['/p.jpg'], pictures)).toBeNull()
    expect(cmsMatchPictureOf(['/p.jpg'], pictures, { index: 1, count: 2 })?.item).toBe('b')
    expect(cmsMatchPictureOf(['/p.jpg'], pictures, { index: 0, count: 3 })).toBeNull()
  })
})

describe('the walk from the clicked element up to the block', () => {
  it('finds the smallest element whose text is one field\'s value, through the look\'s emphasis and spacing', () => {
    const em = e('em', [t('světe')])
    const h = e('h2', [t('Ahoj '), em])
    const root = e('section', [h, e('p', [t('Jiný text')])], { 'data-cms-block': 'b' })
    const fields = cmsMatchFields({ heading: 'Ahoj *světe*' }, textOf('x'))
    const m = cmsMatchAt(cmsMatchChain(em, [root]), fields, () => cmsMatchElements([root]))
    expect(m && 'field' in m && m.el).toBe(h)
    expect(m && 'field' in m && m.field.field).toBe('heading')
    // A text that is no field's value finds nothing; neither does a block with no texts.
    const p = root.childNodes[1] as N
    expect(cmsMatchAt(cmsMatchChain(p, [root]), fields, () => [])).toBeNull()
    expect(cmsMatchAt([h], [], () => [])).toBeNull()
  })

  it('reads a multiline value drawn with a <br> or as paragraphs', () => {
    const fields = cmsMatchFields({ lead: 'První řádek\nDruhý' }, { lead: { text: 'lines' } })
    const withBr = e('p', [t('První řádek'), e('br'), t('Druhý')])
    const asParagraphs = e('div', [e('p', [t('První řádek')]), e('p', [t('Druhý')])])
    for (const el of [withBr, asParagraphs]) {
      const m = cmsMatchAt([el], fields, () => [el])
      expect(m && 'field' in m && m.field.field).toBe('lead')
    }
  })

  it('finds a rich text by its plain text, from a paragraph inside it', () => {
    const para = e('p', [t('Tělo')])
    const body = e('div', [para, e('p', [t('dál')])])
    const fields = cmsMatchFields({ body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tělo' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'dál' }] }] } }, { body: {} })
    const m = cmsMatchAt([para, body], fields, () => [body, para])
    expect(m && 'field' in m && [m.el, m.field.kind]).toEqual([body, 'rich'])
  })

  it('takes a text beside other content of its element as a part of its own, and an element alone before its text', () => {
    // <p><strong>Bez schodu.</strong> Ke vchodu vede rampa.</p>: a title with the look's period, then the text.
    const rest = t(' Ke vchodu vede rampa.')
    const strong = e('strong', [t('Bez schodu.')])
    const p = e('p', [strong, rest])
    const root = e('li', [p])
    const fields = cmsMatchFields({ facts: [{ id: 'f1', title: 'Bez schodu', text: 'Ke vchodu vede rampa.' }] }, { facts: { items: { title: { text: 'line' }, text: { text: 'lines' } } } })
    const all = () => cmsMatchElements([root], { texts: true })
    const onText = cmsMatchAt(cmsMatchChain(rest, [root]), fields, all)
    expect(onText && 'field' in onText && [onText.el, onText.field.field, onText.field.item]).toEqual([rest, 'text', 'f1'])
    const onTitle = cmsMatchAt(cmsMatchChain(strong.childNodes[0] as N, [root]), fields, all)
    expect(onTitle && 'field' in onTitle && [onTitle.el, onTitle.field.field]).toEqual([strong, 'title'])
    expect(all().map((n) => n.name)).toEqual(['li', 'p', 'strong', '#text'])
  })

  it('reads a value inside the quotes or after the dash a look draws around it', () => {
    const fields = cmsMatchFields({ quote: 'Skvělá péče', author: 'Jana' }, { quote: { text: 'lines' }, author: { text: 'line' } })
    for (const [shownText, field] of [['„Skvělá péče“', 'quote'], ['— Jana', 'author'], ['Jana:', 'author'], ['SKVĚLÁ PÉČE', 'quote']] as const) {
      const el = e('p', [t(shownText)])
      const m = cmsMatchAt([el], fields, () => [el])
      expect(m && 'field' in m && m.field.field).toBe(field)
    }
    // An exact value wins over one that differs only by punctuation.
    const both = cmsMatchFields({ a: 'Ano.', b: 'Ano' }, { a: { text: 'line' }, b: { text: 'line' } })
    const el = e('p', [t('Ano')])
    const m = cmsMatchAt([el], both, () => [el])
    expect(m && 'field' in m && m.field.field).toBe('b')
  })

  it('finds a value inside the longer text of the text node clicked on, as whole words, where the click was', () => {
    const fields = cmsMatchFields(
      { season: 'podzim 2026', facts: [{ id: 'a', label: 'Hrací plocha', value: 'tráva' }, { id: 'b', label: 'Vstupné', value: '50 Kč' }], short: 'trá' },
      { season: { text: 'line' }, short: { text: 'line' }, facts: { items: { label: { text: 'line' }, value: { text: 'line' } } } },
    )
    const raw = 'Hrací plocha: tráva,  Vstupné: 50\u00A0Kč'
    expect(cmsMatchInText(raw, 2, fields)).toMatchObject({ field: { field: 'label', item: 'a' }, start: 0, end: 12 })
    expect(cmsMatchInText(raw, 16, fields)).toMatchObject({ field: { field: 'value', item: 'a' }, start: 14, end: 19 })
    // Collapsed spaces and a no-break space: the place in the raw text.
    expect(cmsMatchInText(raw, 33, fields)).toMatchObject({ field: { field: 'value', item: 'b' }, start: 31, end: 36 })
    expect(cmsMatchInText(raw, 13, fields)).toBeNull()
    // Not inside a word: "trá" is no word of "tráva".
    expect(cmsMatchInText('tráva', 1, cmsMatchFields({ short: 'trá' }, { short: { text: 'line' } }))).toBeNull()
    // Through the walk, from the text node under the pointer.
    const node = t('Rozpis · podzim 2026')
    const p = e('p', [node])
    const m = cmsMatchAt(cmsMatchChain(node, [p]), fields, () => [p], undefined, 12)
    expect(m && 'field' in m && [m.el, m.field.field, m.range]).toEqual([node, 'season', [9, 20]])
    expect(cmsMatchAt(cmsMatchChain(node, [p]), fields, () => [p], undefined, 3)).toBeNull()
    // One value in two fields there: nothing.
    const twice = cmsMatchFields({ a: 'trenér', b: 'trenér' }, { a: { text: 'line' }, b: { text: 'line' } })
    expect(cmsMatchInText('Jan Novák, trenér', 13, twice)).toBe('ambiguous')
  })

  it('stops at the block\'s root, and an element outside it has no chain', () => {
    const inner = e('span', [t('a')])
    const root = e('div', [inner])
    e('main', [root])
    expect(cmsMatchChain(inner, [root])).toEqual([inner, root])
    expect(cmsMatchChain(e('i'), [root])).toEqual([])
  })

  it('leaves out what is switched off, and a block inside the block', () => {
    const off = e('h2', [t('Ahoj')], { 'data-cms-field': 'off' })
    const nested = e('div', [e('h3', [t('Ahoj')])], { 'data-cms-block': 'n' })
    const root = e('section', [off, nested, e('p', [t('x')])], { 'data-cms-block': 'b' })
    const fields = cmsMatchFields({ heading: 'Ahoj' }, textOf('x'))
    expect(cmsMatchAt([off, root], fields, () => cmsMatchElements([root]))).toBeNull()
    expect(cmsMatchElements([root]).map((n) => n.name)).toEqual(['section', 'p'])
    // Switched off on the block's root: nothing in the block.
    const offRoot = e('section', [e('h2', [t('Ahoj')])], { 'data-cms-field': 'off' })
    expect(cmsMatchAt(cmsMatchChain(offRoot.childNodes[0] as N, [offRoot]), fields, () => [])).toBeNull()
  })
})

describe('one text, two fields', () => {
  const steps = { steps: { items: { title: { text: 'line' } as CmsBuilderField } } }
  const block = { steps: [{ id: 'a', title: 'Krok' }, { id: 'b', title: 'Jiný' }, { id: 'c', title: 'Krok' }] }

  it('the order tells for one field of items of one list with as many elements of that text', () => {
    const k1 = e('h3', [t('Krok')])
    const k2 = e('h3', [t('Jiný')])
    const k3 = e('h3', [e('span', [t('Krok')])])
    const root = e('ol', [e('li', [k1]), e('li', [k2]), e('li', [k3])])
    const fields = cmsMatchFields(block, steps)
    const all = () => cmsMatchElements([root])
    const first = cmsMatchAt(cmsMatchChain(k1, [root]), fields, all)
    const third = cmsMatchAt(cmsMatchChain(k3.childNodes[0] as N, [root]), fields, all)
    expect(first && 'field' in first && first.field.item).toBe('a')
    // The span is the smallest element with the text: it is the third item's.
    expect(third && 'field' in third && [third.el, third.field.item]).toEqual([k3.childNodes[0], 'c'])
  })

  it('not when the counts differ (a text the look shows once more), nor between two different fields', () => {
    const fields = cmsMatchFields(block, steps)
    const extra = e('div', [e('h3', [t('Krok')]), e('h3', [t('Krok')]), e('p', [t('Krok')])])
    const m = cmsMatchAt([extra.childNodes[0] as N], fields, () => cmsMatchElements([extra]))
    expect(m && 'ambiguous' in m && m.ambiguous.length).toBe(2)
    const twoFields = cmsMatchFields({ heading: 'Ceník', eyebrow: 'Ceník' }, { heading: { text: 'line' }, eyebrow: { text: 'line' } })
    const h = e('h2', [t('Ceník')])
    const r = cmsMatchAt([h], twoFields, () => [h])
    expect(r && 'ambiguous' in r).toBe(true)
  })
})

describe('a marked field', () => {
  it('is no candidate for a text found by itself, so the same words elsewhere belong to the other field', () => {
    const fields = cmsMatchFields({ eyebrow: 'Ceník', heading: 'Ceník' }, { eyebrow: { text: 'line' }, heading: { text: 'line' } })
    const h = e('h2', [t('Ceník')], { 'data-cms-field': 'heading' })
    const rest = t(' · Ceník')
    const p = e('p', [e('span', [t('02')]), rest])
    const root = e('section', [p, h])
    const free = cmsMatchUnmarked(fields, cmsMatchElements([root]))
    expect(free.map((f) => f.field)).toEqual(['eyebrow'])
    const m = cmsMatchAt(cmsMatchChain(rest, [root]), free, () => cmsMatchElements([root], { texts: true }))
    expect(m && 'field' in m && m.field.field).toBe('eyebrow')
    expect(cmsMatchUnmarked(fields, [e('p', [], { 'data-cms-field': 'off' })])).toBe(fields)
  })
})

describe('the cursor in the raw value', () => {
  it('follows the shown text through asterisks, collapsed spaces and line breaks drawn as <br>', () => {
    expect(cmsMatchOffset('Ahoj světe', 'Ahoj *světe*', 8)).toBe(9)
    expect(cmsMatchOffset('Ahoj světe', 'Ahoj *světe*', 4)).toBe(4)
    expect(cmsMatchOffset('Ahoj světe', 'Ahoj *světe*', 10)).toBe(11)
    expect(cmsMatchOffset('k lesu', 'k lesu', 3)).toBe(3)
    expect(cmsMatchOffset('ab', 'a\nb', 1)).toBe(1)
    expect(cmsMatchOffset('ab', 'a\nb', 2)).toBe(3)
    expect(cmsMatchOffset('same', 'same', 2)).toBe(2)
    expect(cmsMatchOffset('x', '', 1)).toBe(0)
  })
})

describe('what is found and what is not', () => {
  it('names the reason of each text not found', () => {
    const fields = cmsMatchFields(
      { heading: 'Nadpis', lead: 'Úvodní věta', phone: '123', choice: 'Dům na klíč', a: 'Dvakrát', b: 'Dvakrát', gone: 'Nikde', hidden: 'Skryté', split: 'Rozdělený text', joined: 'Spojený text' },
      Object.fromEntries(['heading', 'lead', 'phone', 'choice', 'a', 'b', 'gone', 'hidden', 'split', 'joined'].map((k) => [k, { text: 'line' } as CmsBuilderField])),
    )
    const hiddenEl = e('span', [t('Skryté')], { hidden: '' })
    fields.push(...cmsMatchFields({ road: 'silnice I/35' }, { road: { text: 'line' } }))
    const root = e('section', [
      e('h2', [t('Nadpis')], { 'data-cms-field': 'heading' }),
      e('p', [t('Úvodní věta')]),
      e('p', [t('Tel. 123')]),
      e('p', [t('Tel. 1234')]),
      e('select', [e('option', [t('Dům na klíč')])]),
      e('svg', [e('text', [t('silnice I/35')])]),
      e('p', [t('Dvakrát')]),
      hiddenEl,
      e('div', [e('p', [t('Rozdělený')]), e('p', [t('text a víc')])]),
      // Inline parts of one element are one text.
      e('p', [e('b', [t('Spo')]), e('i', [t('jený')]), t(' text')]),
    ])
    const report = cmsMatchReport([root], fields, (n) => n !== hiddenEl && n.name !== 'option' && n.name !== 'select')
    // "123" stands as a word in "Tel. 123": found there.
    expect(report.found.map((x) => [x.field.field, x.marked])).toEqual([['heading', true], ['lead', false], ['joined', false], ['phone', false]])
    expect(Object.fromEntries(report.missed.map((x) => [x.field.field, x.reason]))).toEqual({
      choice: 'form', a: 'ambiguous', b: 'ambiguous', gone: 'not-on-page', hidden: 'hidden', split: 'split', road: 'drawing',
    })
  })
})

describe('the field\'s name for the page', () => {
  it('travels with a block type\'s fields when the admin gives it, and the page takes it', () => {
    const card = defineBlock({ label: 'Card', fields: { title: f.text().label({ cs: 'Název', en: 'Title' }), items: f.list({ fields: { name: f.text() } }) } })
    const defs = blocksGraph({ card }) as any
    const without = blockListKinds({ defs, max: null }, () => 'Card')
    expect(without.types.card!.fields!.title).toEqual({ text: 'line' })
    const named = blockListKinds({ defs, max: null }, () => 'Card', 4, (fd) => (fd.meta?.label?.cs as string | undefined) ?? fd.key)
    expect(named.types.card!.fields!.title).toEqual({ text: 'line', label: 'Název' })
    expect(named.types.card!.fields!.items!.items!.name).toEqual({ text: 'line', label: 'name' })
    const texts = { drag: '', moveUp: '', moveDown: '', duplicate: '', remove: '', insertHere: '' }
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts, selected: null, lists: named })).toBe(true)
    const bad = JSON.parse(JSON.stringify(named))
    bad.types.card.fields.title.label = 5
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts, selected: null, lists: bad })).toBe(false)
  })
})
