// The kit's sections (templates/kit/sections.ts, app/utils/sections.ts, docs/builder-plan.md):
// their blocks, how the page reads them, and the places they are wired in.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GROUP_ARRANGEMENTS, GROUP_MAX, HEADING_SIZES, kitSections, LAYOUT_ALIGNS, LAYOUT_ARRANGEMENTS, LAYOUT_COLUMNS, LAYOUT_MAX, LAYOUT_SIZES, LAYOUT_SPACES, PICTURE_SHAPES, SECTION_ANSWERS, SECTION_SIDES, SECTION_SIZES, SECTION_WIDTHS } from '../../templates/kit/sections'
import { cardsPlan, pictureRatio, questionsPlan, sectionLook, textPicturePlan } from '../../templates/kit/app/utils/sections'
import { GROUP_MOST, LAYOUT_MOST, layoutBox, layoutClasses, layoutItem, layoutPlan, ownRatio } from '../../templates/kit/app/utils/layout'

const repoRoot = join(__dirname, '..', '..')
const templates = readdirSync(join(repoRoot, 'templates'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'kit' && d.name !== 'app' && existsSync(join(repoRoot, 'templates', d.name, 'cms.config.ts')))
  .map((d) => d.name)

type Meta = { meta: { options: readonly string[]; default?: string; max?: number } }
const fieldsOf = (name: keyof ReturnType<typeof kitSections>) => kitSections()[name].fields as unknown as Record<string, Meta>

describe('the kit\'s sections: the blocks', () => {
  const blocks = kitSections()

  it('are four, named with the prefix section_', () => {
    expect(Object.keys(blocks)).toEqual(['section_text_picture', 'section_cards', 'section_questions', 'section_layout'])
  })

  it('have their fields in this order, the shared settings last', () => {
    expect(Object.keys(blocks.section_text_picture.fields)).toEqual(['heading', 'body', 'image', 'buttonLabel', 'buttonLink', 'side', 'size', 'width', 'close'])
    expect(Object.keys(blocks.section_cards.fields)).toEqual(['heading', 'text', 'items', 'columns', 'picture', 'width', 'close'])
    expect(Object.keys(blocks.section_questions.fields)).toEqual(['heading', 'text', 'items', 'answers', 'width', 'close'])
    expect(Object.keys(blocks.section_layout.fields)).toEqual(['items', 'arrangement', 'space', 'align', 'columns', 'width', 'close'])
  })

  it('offer their choices, the default first', () => {
    expect(SECTION_SIDES).toEqual(['right', 'left'])
    expect(SECTION_SIZES).toEqual(['half', 'third'])
    expect(SECTION_ANSWERS).toEqual(['folded', 'open'])
    expect(SECTION_WIDTHS).toEqual(['look', 'narrow'])
    expect(fieldsOf('section_text_picture').side!.meta.options).toEqual(['right', 'left'])
    expect(fieldsOf('section_text_picture').size!.meta.options).toEqual(['half', 'third'])
    expect(fieldsOf('section_questions').answers!.meta.options).toEqual(['folded', 'open'])
    for (const name of Object.keys(blocks) as (keyof typeof blocks)[]) expect(fieldsOf(name).width!.meta.options).toEqual(['look', 'narrow'])
    expect(fieldsOf('section_cards').columns!.meta.options).toEqual(['2', '3', '4'])
    expect(fieldsOf('section_cards').picture!.meta.options).toEqual(['landscape', 'square', 'portrait'])
  })

  it('hold at most 12 cards and 30 questions', () => {
    expect((fieldsOf('section_cards').items as unknown as { meta: { list: { max: number } } }).meta.list.max).toBe(12)
    expect((fieldsOf('section_questions').items as unknown as { meta: { list: { max: number } } }).meta.list.max).toBe(30)
  })

  it('are in the page blocks of all 20 templates, next to the entries blocks', () => {
    expect(templates).toHaveLength(20)
    const wrong = templates.filter((id) => {
      const source = readFileSync(join(repoRoot, 'templates', id, 'cms.config.ts'), 'utf8')
      return !source.includes('...kitEntryBlocks(), ...kitSections()') || !/import \{ kitEntryBlocks, kitSections \} from 'tinyzoo-template-kit\/sections'/.test(source)
    })
    expect(wrong).toEqual([])
  })

  it('are drawn by components the kit\'s module registers for every design', () => {
    const module = readFileSync(join(repoRoot, 'templates', 'kit', 'module.ts'), 'utf8')
    for (const name of ['BlockSectionTextPicture', 'BlockSectionCards', 'BlockSectionQuestions', 'BlockSectionLayout', 'BlockCustomEntries', 'BlockCustomChosen', 'KitLayoutHeading', 'KitLayoutText', 'KitLayoutPicture', 'KitLayoutButton', 'KitLayoutGroup']) {
      expect(module).toContain(`'${name}'`)
      expect(existsSync(join(repoRoot, 'templates', 'kit', 'app', 'components', `${name}.vue`))).toBe(true)
    }
  })
})

describe('the looks\' main button', () => {
  it('is a string of classes where a look sets it, empty only for a look with no .btn', () => {
    const empty: string[] = []
    let set = 0
    for (const id of templates) {
      const source = readFileSync(join(repoRoot, 'templates', id, 'looks.ts'), 'utf8')
      for (const m of source.matchAll(/^\s+button: '([^']*)',$/gm)) {
        set++
        if (m[1] === '') empty.push(id)
        else expect(m[1]).toMatch(/^[a-z][a-z-]*( [a-z][a-z-]*)*$/)
      }
    }
    expect(set).toBeGreaterThan(0)
    expect(empty).toEqual(['blog', 'blog'])
  })
})

describe('the settings every section has', () => {
  it('are the look\'s width and no close, unless the block says otherwise', () => {
    for (const v of [null, undefined, {}, { width: '' }, { width: 'wide' }, { width: 1 }, { close: 'true' }, { close: 1 }, 'x', 5]) expect(sectionLook(v)).toEqual({ narrow: false, close: false })
    expect(sectionLook({ width: 'narrow', close: true })).toEqual({ narrow: true, close: true })
  })
})

describe('text and picture', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }
  const empty = { type: 'doc', content: [{ type: 'paragraph' }] }
  const image = { url: '/a.jpg', width: 1000, height: 500 }

  it('is nothing when it has nothing', () => {
    for (const v of [null, undefined, {}, 'x', 5, { heading: ' ', body: empty, image: { url: '' } }, { buttonLabel: 'Go' }, { buttonLink: '/x' }]) expect(textPicturePlan(v)).toBeNull()
  })

  it('reads the defaults for empty and rubbish choices', () => {
    for (const v of [{}, { side: '' }, { side: 'diagonal', size: '5' }, { side: 1, size: 1 }, { side: null, size: undefined }]) {
      expect(textPicturePlan({ heading: 'H', ...v })).toMatchObject({ side: 'right', size: 'half' })
    }
    expect(textPicturePlan({ heading: 'H', side: 'left', size: 'third' })).toMatchObject({ side: 'left', size: 'third' })
  })

  it('keeps a text, a picture and a heading, and drops an empty text', () => {
    expect(textPicturePlan({ heading: ' H ', body: doc, image })).toMatchObject({ heading: 'H', body: doc, image, button: null })
    expect(textPicturePlan({ heading: 'H', body: empty })!.body).toBeNull()
  })

  it('has a button only with both its text and its link', () => {
    expect(textPicturePlan({ heading: 'H', buttonLabel: 'Go' })!.button).toBeNull()
    expect(textPicturePlan({ heading: 'H', buttonLink: '/x' })!.button).toBeNull()
    expect(textPicturePlan({ buttonLabel: 'Go', buttonLink: '/x' })!.button).toEqual({ label: 'Go', href: '/x' })
  })

  it('gives the picture\'s shape between 4 / 5 and 2 / 1, and none when its size is unknown', () => {
    expect(pictureRatio({ url: '/a', width: 1000, height: 4000 })).toBe('4 / 5')
    expect(pictureRatio({ url: '/a', width: 4000, height: 1000 })).toBe('2 / 1')
    expect(pictureRatio({ url: '/a', width: 1500, height: 1000 })).toBe('1.5')
    expect(pictureRatio({ url: '/a' })).toBeNull()
    expect(pictureRatio({ url: '/a', width: 0, height: 10 })).toBeNull()
    expect(pictureRatio(null)).toBeNull()
    expect(textPicturePlan({ image })!.ratio).toBe('2 / 1')
    expect(textPicturePlan({ image: { url: '/a' } })!.ratio).toBeNull()
  })
})

describe('cards', () => {
  it('are nothing when there is no heading, no text and no card with a title', () => {
    for (const v of [null, undefined, {}, 'x', { items: [] }, { items: [{ text: 'no title' }, null, 'x'] }, { items: [{ title: '  ' }] }]) expect(cardsPlan(v)).toBeNull()
  })

  it('read the defaults for empty and rubbish choices', () => {
    for (const v of [{}, { columns: '' }, { columns: '5' }, { columns: 1 }, { columns: null }]) expect(cardsPlan({ heading: 'H', ...v })).toMatchObject({ columns: 3, picture: 'landscape' })
    for (const v of ['diagonal', 1, '']) expect(cardsPlan({ heading: 'H', picture: v })!.picture).toBe('landscape')
    expect(cardsPlan({ heading: 'H', columns: '4', picture: 'portrait' })).toMatchObject({ columns: 4, picture: 'portrait' })
    expect(cardsPlan({ heading: 'H', columns: 2 })!.columns).toBe(2)
  })

  it('drop a card without a title and make a card of the rest', () => {
    const plan = cardsPlan({ items: [{ id: 'a', title: 'One', text: 'T', link: '/x', image: { url: '/i.jpg' } }, { title: '' }, { id: 'b', title: 'Two' }] })!
    expect(plan.cards).toEqual([
      { id: 'a', title: 'One', href: '/x', image: { url: '/i.jpg' }, meta: '', text: 'T', more: [] },
      { id: 'b', title: 'Two', href: null, image: null, meta: '', text: '', more: [] },
    ])
  })
})

describe('questions', () => {
  it('are nothing when no question is written', () => {
    for (const v of [null, undefined, {}, 'x', { heading: 'H' }, { items: [{ answer: 'A' }, { question: ' ' }] }]) expect(questionsPlan(v)).toBeNull()
  })

  it('are folded unless the block says open', () => {
    const items = [{ question: 'Q?' }]
    for (const v of [undefined, null, '', 'diagonal', 1, 'folded']) expect(questionsPlan({ items, answers: v })!.open).toBe(false)
    expect(questionsPlan({ items, answers: 'open' })!.open).toBe(true)
  })

  it('keep the questions that are written, with or without an answer', () => {
    expect(questionsPlan({ heading: 'H', text: 'T', items: [{ id: 'a', question: 'Q1', answer: 'A1' }, { question: 'Q2' }, { answer: 'lost' }] })).toEqual({
      heading: 'H', text: 'T', open: false, items: [{ id: 'a', question: 'Q1', answer: 'A1' }, { id: '1', question: 'Q2', answer: '' }],
    })
  })
})


type Field = { type: string; meta: Record<string, any>; blocks?: Record<string, { label: Record<string, string>; fields: Record<string, Field> }> }

describe('layout: the block', () => {
  const layout = kitSections().section_layout as unknown as { label: Record<string, string>; icon: string; fields: Record<string, Field> }
  const items = layout.fields.items!
  const group = items.blocks!.group!
  const settingsOf = (fields: Record<string, Field>) => Object.entries(fields).filter(([, f]) => f.meta.setting === true).map(([k]) => k)

  it('is "Rozvržení", with its items first and its settings after them', () => {
    expect(layout.label).toEqual({ en: 'Layout', cs: 'Rozvržení', de: 'Layout' })
    expect(layout.icon).toMatch(/^i-lucide-/)
    expect(items.type).toBe('blocks')
    expect(settingsOf(layout.fields)).toEqual(['arrangement', 'space', 'align', 'columns', 'width', 'close'])
  })

  it('offers its choices as segments, the default first in the constants', () => {
    expect(LAYOUT_ARRANGEMENTS).toEqual(['row', 'stack', 'grid'])
    expect(GROUP_ARRANGEMENTS).toEqual(['stack', 'row'])
    expect(LAYOUT_SPACES).toEqual(['medium', 'small', 'large'])
    expect(LAYOUT_ALIGNS).toEqual(['start', 'center', 'end'])
    expect(LAYOUT_COLUMNS).toEqual(['3', '2', '4'])
    expect(LAYOUT_SIZES).toEqual(['fill', 'content'])
    expect(HEADING_SIZES).toEqual(['medium', 'large', 'small'])
    expect(PICTURE_SHAPES).toEqual(['original', 'landscape', 'square', 'portrait'])
    const f = layout.fields
    expect(f.arrangement!.meta.options).toEqual(['row', 'stack', 'grid'])
    expect(f.space!.meta.options).toEqual(['small', 'medium', 'large'])
    expect(f.align!.meta.options).toEqual(['start', 'center', 'end'])
    expect(f.columns!.meta.options).toEqual(['2', '3', '4'])
    expect(f.width!.meta.options).toEqual(['look', 'narrow'])
    for (const key of ['arrangement', 'space', 'align', 'columns']) expect(f[key]!.meta.segments, key).toBe(true)
    for (const key of ['arrangement', 'align']) expect(Object.keys(f[key]!.meta.icons), key).toEqual(f[key]!.meta.options)
    expect(f.close!.type).toBe('boolean')
  })

  it('holds the four small blocks and a group, each named in three languages', () => {
    expect(Object.keys(items.blocks!)).toEqual(['heading', 'text', 'picture', 'button', 'group'])
    expect(Object.fromEntries(Object.entries(items.blocks!).map(([k, b]) => [k, b.label.cs]))).toEqual({ heading: 'Nadpis', text: 'Text', picture: 'Obrázek', button: 'Tlačítko', group: 'Skupina' })
    for (const b of Object.values(items.blocks!)) expect(Object.keys(b.label)).toEqual(['en', 'cs', 'de'])
    expect(Object.keys(group.fields.items!.blocks!)).toEqual(['heading', 'text', 'picture', 'button'])
    expect(LAYOUT_MAX).toBe(LAYOUT_MOST)
    expect(GROUP_MAX).toBe(GROUP_MOST)
  })

  it('gives every small block and the group one size, a setting: fill or content', () => {
    const all = { ...items.blocks!, ...Object.fromEntries(Object.entries(group.fields.items!.blocks!).map(([k, b]) => [`group.${k}`, b])) }
    for (const [name, b] of Object.entries(all)) {
      expect(b.fields.size!.meta.options, name).toEqual(['fill', 'content'])
      expect(b.fields.size!.meta.setting, name).toBe(true)
      expect(b.fields.size!.meta.labels.content.cs, name).toBe('Podle obsahu')
      expect(b.fields.size!.meta.labels.fill.cs, name).toBe('Vyplnit')
    }
  })

  it('has the fields of each small block in this order, the settings last', () => {
    const b = items.blocks!
    expect(Object.keys(b.heading!.fields)).toEqual(['text', 'level', 'size'])
    expect(Object.keys(b.text!.fields)).toEqual(['body', 'size'])
    expect(Object.keys(b.picture!.fields)).toEqual(['image', 'shape', 'size'])
    expect(Object.keys(b.button!.fields)).toEqual(['label', 'link', 'size'])
    expect(Object.keys(group.fields)).toEqual(['items', 'arrangement', 'space', 'align', 'size'])
    expect(settingsOf(b.heading!.fields)).toEqual(['level', 'size'])
    expect(settingsOf(b.text!.fields)).toEqual(['size'])
    expect(settingsOf(b.picture!.fields)).toEqual(['shape', 'size'])
    expect(settingsOf(b.button!.fields)).toEqual(['size'])
    expect(settingsOf(group.fields)).toEqual(['arrangement', 'space', 'align', 'size'])
    expect(b.heading!.fields.level!.meta.options).toEqual(['large', 'medium', 'small'])
    expect(b.picture!.fields.shape!.meta.options).toEqual(['original', 'landscape', 'square', 'portrait'])
    expect(group.fields.arrangement!.meta.options).toEqual(['stack', 'row'])
    expect(b.button!.fields.link!.meta.format).toBe('link')
  })
})

describe('layout: how it is read', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }
  const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] }
  const image = { url: '/a.jpg', width: 1200, height: 800 }
  const heading = (id: string, extra = {}) => ({ id, type: 'heading', text: 'H', ...extra })

  it('is nothing when every small block is empty, unknown or a group of nothing', () => {
    for (const v of [null, undefined, 'x', 5, {}, { items: [] }, { items: 'x' }, {
      items: [
        null, 'x', { id: 'a', type: 'heading', text: '  ' }, { id: 'b', type: 'text', body: emptyDoc }, { id: 'c', type: 'picture', image: { url: '' } },
        { id: 'd', type: 'button', label: 'Go' }, { id: 'e', type: 'button', link: '/x' }, { id: 'f', type: 'hero', heading: 'H' },
        { id: 'g', type: 'group', items: [{ id: 'h', type: 'heading' }] }, { id: 'i', type: 'group' },
      ],
    }]) expect(layoutPlan(v)).toBeNull()
  })

  it('reads the defaults for empty and rubbish choices', () => {
    for (const v of [{}, { arrangement: '', space: '', align: '', columns: '' }, { arrangement: 'diagonal', space: 'huge', align: 'left', columns: '5' }, { arrangement: 1, space: null, align: undefined, columns: 1 }]) {
      expect(layoutPlan({ items: [heading('a')], ...v })).toMatchObject({ arrangement: 'row', space: 'medium', align: 'start', columns: 3 })
    }
    expect(layoutPlan({ items: [heading('a')], arrangement: 'grid', space: 'large', align: 'end', columns: '4' })).toMatchObject({ arrangement: 'grid', space: 'large', align: 'end', columns: 4 })
    expect(layoutBox({ columns: 2 }).columns).toBe(2)
    // A group is a stack unless it says row; it has no grid.
    for (const a of [undefined, '', 'grid', 'diagonal']) expect(layoutBox({ arrangement: a }, true).arrangement).toBe('stack')
    expect(layoutBox({ arrangement: 'row' }, true).arrangement).toBe('row')
  })

  it('reads every small block, with the defaults for its own choices', () => {
    expect(layoutItem({ id: 'a', type: 'heading', text: ' Hi ', level: 'huge', size: 'wide' })).toEqual({ id: 'a', type: 'heading', size: 'fill', text: 'Hi', level: 'medium' })
    expect(layoutItem({ id: 'a', type: 'heading', text: 'Hi', level: 'large', size: 'content' })).toEqual({ id: 'a', type: 'heading', size: 'content', text: 'Hi', level: 'large' })
    expect(layoutItem({ id: 'b', type: 'text', body: doc })).toEqual({ id: 'b', type: 'text', size: 'fill', body: doc })
    expect(layoutItem({ id: 'c', type: 'picture', image })).toEqual({ id: 'c', type: 'picture', size: 'fill', image, shape: 'original', ratio: '1200 / 800' })
    expect(layoutItem({ id: 'c', type: 'picture', image, shape: 'square' })).toMatchObject({ shape: 'square', ratio: '1 / 1' })
    expect(layoutItem({ id: 'c', type: 'picture', image, shape: 'portrait' })).toMatchObject({ ratio: '3 / 4' })
    expect(layoutItem({ id: 'c', type: 'picture', image, shape: 'landscape' })).toMatchObject({ ratio: '4 / 3' })
    expect(layoutItem({ id: 'c', type: 'picture', image: { url: '/a' }, shape: 'oval' })).toMatchObject({ shape: 'original', ratio: null })
    expect(layoutItem({ id: 'd', type: 'button', label: ' Go ', link: '/x', size: 'content' })).toEqual({ id: 'd', type: 'button', size: 'content', label: 'Go', href: '/x' })
    expect(ownRatio({ url: '/a', width: 0, height: 5 })).toBeNull()
    expect(ownRatio(null)).toBeNull()
  })

  it('names a block without an id by its place', () => {
    expect(layoutPlan({ items: [{ type: 'heading', text: 'A' }, heading('b'), { type: 'heading', text: 'C', id: '' }] })!.items.map((i) => i.id)).toEqual(['0', 'b', '2'])
  })

  it('keeps a group with what it holds, two levels and no deeper', () => {
    const plan = layoutPlan({
      items: [{
        id: 'g', type: 'group', arrangement: 'row', space: 'small', align: 'center', size: 'content',
        items: [heading('a'), { id: 'x', type: 'heading', text: ' ' }, { id: 'n', type: 'group', items: [heading('deep')] }, { id: 'b', type: 'button', label: 'Go', link: '/x' }],
      }],
    })!
    expect(plan.items).toEqual([{
      id: 'g', type: 'group', size: 'content', arrangement: 'row', space: 'small', align: 'center', columns: 3,
      items: [{ id: 'a', type: 'heading', size: 'fill', text: 'H', level: 'medium' }, { id: 'b', type: 'button', size: 'fill', label: 'Go', href: '/x' }],
    }])
    expect(layoutItem({ id: 'g', type: 'group', items: [heading('a')] }, 0, true)).toBeNull()
  })

  it('draws at most 12 blocks in a section and 8 in a group', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => heading(`h${i}`))
    expect(layoutPlan({ items: many(15) })!.items).toHaveLength(12)
    const g = layoutPlan({ items: [{ id: 'g', type: 'group', items: many(10) }] })!.items[0] as { items: unknown[] }
    expect(g.items).toHaveLength(8)
  })

  it('gives the container its classes', () => {
    expect(layoutClasses(layoutBox({}))).toEqual(['kit-lay', 'kit-lay-row', 'kit-lay-gap-medium', 'kit-lay-align-start'])
    expect(layoutClasses(layoutBox({ arrangement: 'grid', columns: '2', space: 'small', align: 'center' }))).toEqual(['kit-lay', 'kit-lay-grid', 'kit-lay-gap-small', 'kit-lay-align-center', 'kit-lay-cols-2'])
  })

  it('has the settings every section has', () => {
    expect(sectionLook({ items: [], width: 'narrow', close: true })).toEqual({ narrow: true, close: true })
  })
})

describe('layout: how it is drawn', () => {
  const kit = (file: string) => readFileSync(join(repoRoot, 'templates', 'kit', 'app', 'components', file), 'utf8')

  it('draws its lists with <CmsBlocks prefix="KitLayout">, in the section and in a group', () => {
    expect(kit('BlockSectionLayout.vue')).toContain('<CmsBlocks :blocks="plan.items" prefix="KitLayout" />')
    expect(kit('KitLayoutGroup.vue')).toContain('<CmsBlocks :blocks="block.items" prefix="KitLayout" />')
  })

  it('gives each small block one root element, and never an h1', () => {
    for (const name of ['KitLayoutHeading', 'KitLayoutText', 'KitLayoutPicture', 'KitLayoutButton', 'KitLayoutGroup']) {
      const template = kit(`${name}.vue`).split('<template>')[1]!.split('</template>').slice(0, -1).join('</template>')
      const roots = template.split('\n').filter((l) => /^ {2}<[a-zA-Z]/.test(l))
      expect(roots, name).toHaveLength(1)
      expect(template, name).not.toMatch(/h1/)
    }
  })

  it('writes every rule of its stylesheet from the section\'s root class', () => {
    const style = kit('BlockSectionLayout.vue').split('<style>')[1]!.split('</style>')[0]!
    const selectors = style.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')[0]!.trim()).filter(Boolean).flatMap((s) => s.split(',').map((x) => x.trim()))
    expect(selectors.length).toBeGreaterThan(20)
    for (const s of selectors) {
      expect(s, s).toMatch(/^\.kit-section /)
      expect((s.match(/\.[a-z][a-z0-9-]*/g) ?? []).length, s).toBeGreaterThanOrEqual(3)
    }
  })
})
