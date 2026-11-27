import { describe, expect, it } from 'vitest'
import { emphasisParts, plainEmphasis, tidyText } from '../../templates/kit/app/utils/emphasis'
import { defineSingleton, f } from 'tinyzoo'
import { defineLooks, presetStyle, presetSwatch } from '../../templates/kit/looks'
import { byLength, dateParts, formatDate, formatPrice, paragraphs, siteHref, socialHandle, telHref, timeAttr } from '../../templates/kit/app/utils/format'
import { mixAlbumPhotos, shapeOf, tileCategories, frameCode } from '../../templates/photographer/app/utils/site'
import type { Album } from '../../templates/photographer/app/lib/cms-content'

// What the hosted templates share (templates/kit), and the Photographer template's own helpers.

describe('a text with one marked part', () => {
  it('splits at the asterisks', () => {
    expect(emphasisParts('Napište mi *o termín.*')).toEqual([{ text: 'Napište mi ', marked: false }, { text: 'o termín.', marked: true }])
    expect(emphasisParts('Bez označení')).toEqual([{ text: 'Bez označení', marked: false }])
    expect(emphasisParts('*Celé*')).toEqual([{ text: 'Celé', marked: true }])
    expect(emphasisParts(null)).toEqual([])
  })

  it('leaves a lone asterisk alone, and reads plain without the marks', () => {
    expect(emphasisParts('5 * 3')).toEqual([{ text: '5 * 3', marked: false }])
    expect(plainEmphasis('Držím se zpátky a *dívám se.*')).toBe('Držím se zpátky a dívám se.')
  })
})

describe('Czech line breaks', () => {
  const nb = ' '
  it('keep a one-letter word and a short preposition with the next word', () => {
    expect(tidyText('Svatby a rodiny v Litomyšli')).toBe(`Svatby a${nb}rodiny v${nb}Litomyšli`)
    expect(tidyText('Cesta do 50 km od Litomyšle')).toBe(`Cesta do${nb}50${nb}km od${nb}Litomyšle`)
    expect(tidyText('U portrétů si povídáme')).toBe(`U${nb}portrétů si povídáme`)
    expect(tidyText('venku a v podvečer')).toBe(`venku a${nb}v${nb}podvečer`)
  })

  it('keep a number with what it counts', () => {
    expect(tidyText('od 19 900 Kč, záloha 30 %')).toBe(`od${nb}19${nb}900${nb}Kč, záloha 30${nb}%`)
    expect(tidyText('5 zvětšenin 13 × 18 cm')).toBe(`5 zvětšenin 13${nb}×${nb}18${nb}cm`)
  })

  it('leave other words, line ends and empty values as they are', () => {
    expect(tidyText('Obřad pod lípou')).toBe('Obřad pod lípou')
    expect(tidyText('první\ndruhý')).toBe('první\ndruhý')
    expect(tidyText(null)).toBe('')
  })
})

describe('looks and colour presets', () => {
  const looks = defineLooks([
    { id: 'one', name: { cs: 'Jedna', en: 'One' }, presets: [{ id: 'a', name: { cs: 'A', en: 'A' }, vars: { '--brand': '#112233' } }, { id: 'b', name: { cs: 'B', en: 'B' }, vars: { '--brand': '#445566' } }] },
    { id: 'two', name: { cs: 'Dva', en: 'Two' }, presets: [{ id: 'c', name: { cs: 'C', en: 'C' }, vars: { '--brand': '#778899', '--bg': 'rgb(0 0 0)' } }] },
  ])

  it('list ids and labels for the two choices in Site settings', () => {
    expect(looks.ids).toEqual(['one', 'two'])
    expect(looks.presetIds).toEqual(['a', 'b', 'c'])
    expect(looks.labels.two).toEqual({ cs: 'Dva', en: 'Two' })
    expect(looks.presetLabels.b).toEqual({ cs: 'Jedna · B', en: 'One · B' })
  })

  it('give the colours choice only the chosen look\'s presets, with their colours as dots', () => {
    expect(looks.presetsByLook).toEqual({ one: ['a', 'b'], two: ['c'] })
    expect(looks.presetNames.b).toEqual({ cs: 'B', en: 'B' })
    // The brand colour, then the background when it is a plain hex colour (`rgb(0 0 0)` is not).
    expect(looks.swatches).toEqual({ a: ['#112233'], b: ['#445566'], c: ['#778899'] })
    expect(presetSwatch({ id: 'p', name: { cs: 'P', en: 'P' }, vars: { '--paper': '#FAF8F4', '--brand': '#7a5a3a', '--tint': '#f1ece3', '--line': '#dfd8cc' } })).toEqual(['#7a5a3a', '#faf8f4', '#f1ece3'])
    expect(presetSwatch({ id: 'p', name: { cs: 'P', en: 'P' }, vars: { '--brand': '#7a5a3a' }, swatch: ['#000000', '#ffffff'] })).toEqual(['#000000', '#ffffff'])
    expect(looks.fields.look).toEqual({ options: ['one', 'two'], default: 'one', labels: looks.labels })
    expect(looks.fields.colors).toMatchObject({ options: ['a', 'b', 'c'], default: 'a', optionsBy: { field: 'look', options: looks.presetsByLook } })
    // The pair is what f.select takes: the content model accepts it as it is.
    const settings = defineSingleton('settings', { label: 'S', titleField: 'look', fields: { look: f.select(looks.fields.look), colors: f.select(looks.fields.colors) } })
    expect((settings.fields.colors.meta as any).optionsBy.field).toBe('look')
  })

  it('resolve to the first look and the look\'s first colours when a choice is missing or foreign', () => {
    expect(looks.resolve(undefined, undefined)).toMatchObject({ look: { id: 'one' }, preset: { id: 'a' }, style: '--brand:#112233', own: null })
    expect(looks.resolve('one', 'b').preset.id).toBe('b')
    expect(looks.resolve('two', 'b').preset.id).toBe('c')
    expect(looks.resolve('two', 'c').style).toBe('--brand:#778899;--bg:rgb(0 0 0)')
  })

  it('show the preset as it is when the owner\'s colour is its own, a palette for another, and nothing for a colour that is none', () => {
    const same = looks.resolve('one', 'a', { color: '#112233' })
    expect(same.style).toBe('--brand:#112233')
    expect(same.own).toEqual({ given: '#112233', shown: '#112233' })
    const other = looks.resolve('one', 'a', { color: '#aa3355' })
    expect(other.own?.given).toBe('#aa3355')
    expect(other.style).toBe(`--brand:${other.own?.shown}`)
    expect(looks.resolve('one', 'a', { color: 'red' }).own).toBeNull()
    expect(looks.resolve('one', 'a', { color: 'red' }).style).toBe('--brand:#112233')
  })

  it('refuse a preset id used twice, and write nothing but plain custom properties into a style', () => {
    expect(() => defineLooks([{ id: 'x', name: { cs: 'X', en: 'X' }, presets: [{ id: 'a', name: { cs: 'A', en: 'A' }, vars: {} }, { id: 'a', name: { cs: 'A', en: 'A' }, vars: {} }] }])).toThrow(/listed twice/)
    expect(presetStyle({ id: 'p', name: { cs: 'P', en: 'P' }, vars: { '--ok': '#fff', '--bad': 'red;background:url(x)', '--also bad': '#000' } as any })).toBe('--ok:#fff')
  })
})

describe('the Photographer template\'s helpers', () => {
  const media = (id: string, width: number, height: number, caption: string | null = null) => ({ id, url: `/m/${id}.jpg`, width, height, alt: id, mime: 'image/jpeg', focal: null, caption })
  const category = (id: string, name: string, position: number) => ({ id, name, slug: id, description: null, position })
  const album = (id: string, cat: ReturnType<typeof category>, photos: ReturnType<typeof media>[]): Album => ({ id, title: `Album ${id}`, slug: id, status: 'published', category: cat, date: null, place: 'Místo', summary: null, cover: null, photos, metaTitle: null, metaDescription: null, ogImage: null, createdAt: '', updatedAt: '' })
  const weddings = category('w', 'Svatby', 0)
  const portraits = category('p', 'Portréty', 1)
  const albums = [
    album('big', weddings, [media('b1', 1800, 1200, 'První'), media('b2', 1440, 1800), media('b3', 1800, 1800), media('b4', 1800, 1200)]),
    album('s1', portraits, [media('p1', 1440, 1800)]),
    album('s2', portraits, [media('p2', 1800, 1800)]),
    album('s3', weddings, [media('w1', 1800, 1200)]),
  ]

  it('mix the albums\' photographs: every one once, a large album spread out, the same order every time', () => {
    const tiles = mixAlbumPhotos(albums)
    expect(tiles.map((t) => t.media.id)).toEqual(['b1', 'p1', 'b2', 'p2', 'b3', 'w1', 'b4'])
    expect(mixAlbumPhotos(albums).map((t) => t.key)).toEqual(tiles.map((t) => t.key))
    // no two pictures of the large album side by side while others are left
    const fromBig = tiles.map((t) => t.album.id === 'big')
    expect(fromBig.slice(0, 6).some((v, i) => v && fromBig[i + 1])).toBe(false)
  })

  it('leave pictures out, cut the row, and number the frames within a category', () => {
    const tiles = mixAlbumPhotos(albums, { skip: new Set(['b1']), limit: 4 })
    expect(tiles).toHaveLength(4)
    expect(tiles.some((t) => t.media.id === 'b1')).toBe(false)
    const all = mixAlbumPhotos(albums)
    expect(all.filter((t) => t.category.id === 'w').map((t) => t.frame)).toEqual([1, 2, 3, 4, 5])
    expect(frameCode(all[0]!)).toBe('SV–01')
    expect(tileCategories(all)).toEqual([{ id: 'w', name: 'Svatby', slug: 'w', count: 5 }, { id: 'p', name: 'Portréty', slug: 'p', count: 2 }])
    expect(all[0]!.caption).toBe('První')
    expect(all[1]!.caption).toBeNull()
  })

  it('snap a picture to one of three shapes', () => {
    expect(shapeOf({ width: 1800, height: 1200 })).toEqual({ shape: 'wide', ratio: 1.5 })
    expect(shapeOf({ width: 1440, height: 1800 })).toEqual({ shape: 'tall', ratio: 0.8 })
    expect(shapeOf({ width: 1000, height: 1000 })).toEqual({ shape: 'square', ratio: 1 })
    expect(shapeOf(null)).toEqual({ shape: 'square', ratio: 1 })
  })

  it('write prices, dates, phones and addresses the Czech way', () => {
    expect(formatPrice(19900)).toBe('19 900')
    expect(formatDate('2026-08-21T22:00:00Z')).toBe('22. srpna 2026')
    expect(formatDate('2026-08-21T22:00:00Z', 'short')).toBe('8/2026')
    expect(formatDate(null)).toBe('')
    expect(telHref('+420 731 482 906')).toBe('tel:+420731482906')
    expect(socialHandle('https://www.instagram.com/johana.loudova/')).toBe('@johana.loudova')
    expect(socialHandle('https://www.instagram.com')).toBe('Instagram')
    expect(siteHref('/home')).toBe('/')
    expect(siteHref('/cenik')).toBe('/cenik')
    expect(siteHref('/home#program')).toBe('/#program')
    expect(siteHref('/homestead')).toBe('/homestead')
    expect(siteHref('/#ucast')).toBe('/#ucast')
    expect(dateParts('2027-06-19T10:30:00Z')).toMatchObject({ weekday: 'sobota', day: '19', month: 'června', year: '2027', time: '12.30', date: '19. června 2027', iso: '2027-06-19T12:30' })
    expect(dateParts('2027-04-29T22:00:00Z')).toMatchObject({ weekday: 'pátek', date: '30. dubna 2027', time: '', iso: '2027-04-30' })
    expect(dateParts('')).toBeNull()
    expect(timeAttr('11.30')).toBe('11:30')
    expect(timeAttr('2.00')).toBe('02:00')
    expect(timeAttr('po půlnoci')).toBe('')
    expect(paragraphs('Jedna.\n\nDva.\n \nTři.')).toEqual(['Jedna.', 'Dva.', 'Tři.'])
  })

  it('pick a size by the length of a heading, not counting the marks', () => {
    const steps: Array<[number, string]> = [[10, 'big'], [20, 'medium']]
    expect(byLength('Ceník', steps, 'small')).toBe('big')
    expect(byLength('Napište mi *o termín.*', steps, 'small')).toBe('medium')
    expect(byLength('Svatby, portréty a rodiny ve východních Čechách.', steps, 'small')).toBe('small')
  })
})
