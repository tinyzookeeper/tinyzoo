import { describe, expect, it } from 'vitest'
import { defineBlock, editDistance, entryTexts, excerptOf, f, foldSearchText, highlightRanges, matchEntry, richTextPlain, searchTerms, wordMatch } from 'tinyzoo'

const doc = (...paras: string[]) => ({ type: 'doc', content: paras.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })) })

describe('search terms', () => {
  it('folds case and accents, splits words and drops the ones a longer word covers', () => {
    expect(foldSearchText('Zimní PŘÍPRAVA Łódź')).toBe('zimni priprava lodz')
    expect(searchTerms('  Kvásek, chléb  ')).toEqual(['kvasek', 'chleb'])
    expect(searchTerms('chleb chlebovy')).toEqual(['chlebovy'])
    expect(searchTerms('"náhled"!')).toEqual(['nahled'])
    expect(searchTerms('   ')).toEqual([])
  })

  it('folds a non-breaking or other Unicode space to a plain one, one character for one', () => {
    expect(foldSearchText('Obrázky v\u00a0textu')).toBe('obrazky v textu')
    expect(foldSearchText('a\u202fb\u2009c\u3000d')).toBe('a b c d')
    expect(searchTerms('obrázky\u00a0v\u00a0textu')).toEqual(['obrazky', 'v', 'textu'])
  })

  it('ranks a title written with non-breaking spaces as high as one with plain spaces (Czech typography)', () => {
    const query = 'obrázky v textu'
    const terms = searchTerms(query)
    const plain = matchEntry('Obrázky v textu', [], terms, query)!
    const nbsp = matchEntry('Obrázky v\u00a0textu', [], terms, query)!
    expect(nbsp.score).toBe(plain.score)
    expect(nbsp.score).toBeGreaterThanOrEqual(190) // the whole query is the title
    // the highlights still land on the title's own characters
    expect(highlightRanges('Obrázky v\u00a0textu', terms)).toEqual(highlightRanges('Obrázky v textu', terms))
  })
})

describe('what an entry says', () => {
  const card = defineBlock({ label: 'Cards', fields: { heading: f.text(), url: f.text({ format: 'link' }), items: f.list({ fields: { title: f.text(), text: f.text({ multiline: true }) } }) } })
  const text = defineBlock({ label: 'Text', fields: { body: f.richtext() } })
  const fields = {
    perex: f.text(),
    email: f.text({ format: 'email' }),
    status: f.select({ options: ['draft', 'published'] as const }),
    body: f.richtext(),
    sections: f.blocks({ card, text }),
  } as any

  it('reads text, rich text and the text inside blocks and lists — never addresses, choices or type names', () => {
    const row = {
      perex: 'Krátce o zimě',
      email: 'trener@example.com',
      status: 'published',
      body: doc('První odstavec.', 'Druhý odstavec.'),
      sections: [
        { id: 'a', type: 'card', heading: 'Naše tréninky', url: '/treninky', items: [{ id: 'i', type: 'item', title: 'Plavání', text: 'Každé úterý' }] },
        { id: 'b', type: 'text', body: doc('Bazén Tábor') },
        { id: 'c', type: 'gone', heading: 'Unknown block type' },
      ],
    }
    const texts = entryTexts(fields, row)
    expect(texts).toEqual(['Krátce o zimě', 'První odstavec.\nDruhý odstavec.', 'Naše tréninky', 'Plavání', 'Každé úterý', 'Bazén Tábor'])
    expect(texts.join(' ')).not.toMatch(/example\.com|published|treninky|card|Unknown/)
    expect(entryTexts(fields, row, new Set(['perex', 'sections']))).toEqual(['První odstavec.\nDruhý odstavec.'])
  })

  it('keeps rich-text paragraphs, headings and list items apart', () => {
    const rich = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Nadpis' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'jedna' }, { type: 'hardBreak' }, { type: 'text', text: 'dva', marks: [{ type: 'bold' }] }] }] }] },
      ],
    }
    expect(richTextPlain(rich)).toBe('Nadpis\njedna dva')
    expect(richTextPlain(null)).toBe('')
  })
})

describe('matching and ranking', () => {
  const terms = searchTerms('zimni priprava')

  it('needs every word, somewhere in the title or the text', () => {
    expect(matchEntry('Zimní soustředění', ['Příprava na sezónu'], terms)).not.toBeNull()
    expect(matchEntry('Zimní soustředění', ['Letní tábor'], terms)).toBeNull()
  })

  it('ranks a title match above a text match, and the whole phrase in the title highest', () => {
    const phrase = matchEntry('Zimní příprava', [], terms)!.score
    const words = matchEntry('Příprava, zimní', [], terms)!.score
    const inText = matchEntry('Novinky', ['Zimní příprava začíná'], terms)!.score
    expect(phrase).toBeGreaterThan(words)
    expect(words).toBeGreaterThan(inText)
  })

  it('cuts a snippet around the first word found, with its words marked', () => {
    const long = `${'Úvodní věta o ničem. '.repeat(12)}Zimní příprava začíná v listopadu v bazénu. ${'Další text. '.repeat(20)}`
    const { excerpt, highlights } = excerptOf(long, terms)
    expect(excerpt.startsWith('…')).toBe(true)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt).toContain('Zimní příprava začíná')
    expect(excerpt.length).toBeLessThan(200)
    expect(highlights.map(([s, e]) => excerpt.slice(s, e))).toEqual(['Zimní', 'příprava'])
  })

  it('marks words in a title in its own characters, accents included', () => {
    const title = 'Příprava na ZIMNÍ sezónu'
    expect(highlightRanges(title, terms).map(([s, e]) => title.slice(s, e))).toEqual(['Příprava', 'ZIMNÍ'])
  })

  it('has no snippet when only the title matched', () => {
    expect(matchEntry('Zimní příprava', ['Nic dalšího'], terms)!.excerpt).toBe('')
  })
})

describe('snippet lines', () => {
  it('sets a heading apart from the text after it, but runs sentences on', () => {
    const { excerpt } = excerptOf('Společně v jednom článku\nPište ve stejném článku.\nVidíte, kde druhý píše.', searchTerms('piste'))
    expect(excerpt).toBe('Společně v jednom článku · Pište ve stejném článku. Vidíte, kde druhý píše.')
  })
})

describe('typos', () => {
  it('allows one typo in a word of 4–7 letters and two from 8, a swap counting as one', () => {
    expect(wordMatch('bazen', 'bazenu')).toBe('exact')
    expect(wordMatch('bazne', 'bazenu')).toBe('typo') // swapped letters
    expect(wordMatch('baezn', 'bazenu')).toBe('typo')
    expect(wordMatch('preveiw', 'preview')).toBe('typo')
    expect(wordMatch('sousterdeni', 'soustredeni')).toBe('typo')
    expect(wordMatch('soustrdni', 'soustredeni')).toBe('typo') // two letters missing, long word
    expect(wordMatch('bazar', 'bazenu')).toBeNull() // two edits in a short word: another word
    expect(wordMatch('kos', 'kus')).toBeNull() // under four letters: exact only
  })

  it('lets other forms of a word match (a different ending)', () => {
    expect(wordMatch('priprava', 'priprave')).toBe('typo')
    expect(wordMatch('zima', 'zimni')).toBe('typo')
  })

  it('counts edits, giving up past the limit', () => {
    expect(editDistance('abcd', 'abdc')).toBe(1)
    expect(editDistance('kitten', 'sitting')).toBe(3)
    expect(editDistance('a', 'abcdef', 2)).toBe(3)
  })

  it('finds an entry despite a typo, ranks the right spelling higher and marks the word as written', () => {
    const typo = matchEntry('Plavání', ['Každé úterý v plaveckém bazénu.'], searchTerms('bazne'))!
    expect(typo).not.toBeNull()
    expect(typo.highlights.map(([s, e]) => typo.excerpt.slice(s, e))).toEqual(['bazénu'])
    const right = matchEntry('Plavání', ['Každé úterý v plaveckém bazénu.'], searchTerms('bazen'))!
    expect(right.score).toBeGreaterThan(typo.score)
    expect(matchEntry('Plavání', ['Každé úterý v plaveckém bazénu.'], searchTerms('bazar'))).toBeNull()
  })
})
