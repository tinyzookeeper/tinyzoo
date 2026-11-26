// The kit's sections (templates/kit/sections.ts, app/utils/sections.ts, docs/builder-plan.md):
// their blocks, how the page reads them, and the places they are wired in.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { kitSections, SECTION_ANSWERS, SECTION_SIDES, SECTION_SIZES, SECTION_WIDTHS } from '../../templates/kit/sections'
import { cardsPlan, pictureRatio, questionsPlan, sectionLook, textPicturePlan } from '../../templates/kit/app/utils/sections'

const repoRoot = join(__dirname, '..', '..')
const templates = readdirSync(join(repoRoot, 'templates'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'kit' && d.name !== 'app' && existsSync(join(repoRoot, 'templates', d.name, 'cms.config.ts')))
  .map((d) => d.name)

type Meta = { meta: { options: readonly string[]; default?: string; max?: number } }
const fieldsOf = (name: keyof ReturnType<typeof kitSections>) => kitSections()[name].fields as unknown as Record<string, Meta>

describe('the kit\'s sections: the blocks', () => {
  const blocks = kitSections()

  it('are three, named with the prefix section_', () => {
    expect(Object.keys(blocks)).toEqual(['section_text_picture', 'section_cards', 'section_questions'])
  })

  it('have their fields in this order, the shared settings last', () => {
    expect(Object.keys(blocks.section_text_picture.fields)).toEqual(['heading', 'body', 'image', 'buttonLabel', 'buttonLink', 'side', 'size', 'width', 'close'])
    expect(Object.keys(blocks.section_cards.fields)).toEqual(['heading', 'text', 'items', 'columns', 'picture', 'width', 'close'])
    expect(Object.keys(blocks.section_questions.fields)).toEqual(['heading', 'text', 'items', 'answers', 'width', 'close'])
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
    for (const name of ['BlockSectionTextPicture', 'BlockSectionCards', 'BlockSectionQuestions', 'BlockCustomEntries', 'BlockCustomChosen']) {
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
