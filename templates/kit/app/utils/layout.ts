// What the kit reads from a Layout section (`section_layout`, kitSections()) before it draws it: the
// arrangement, the space, the alignment, and its small blocks and groups. Plain functions of their
// arguments, so the unit specs test them without Nuxt (test/unit/template-kit-sections.spec.ts).
// (Only type imports: the file is loaded outside Nuxt.)
//
// An empty or unknown value is the default, because the admin does not carry a field's default: a
// block saved before a choice existed is drawn as a new one. A small block with nothing in it, a
// block of an unknown type and a group inside a group are left out; a group whose blocks are all
// left out is left out too; a section with nothing left gives null, and nothing is drawn.
import type { CustomMedia } from './customTypes'

type Rec = Record<string, any>
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const media = (v: unknown): CustomMedia | null => (isRec(v) && typeof v.url === 'string' && v.url !== '' ? (v as CustomMedia) : null)
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback)

/** Whether a rich text (TipTap JSON) holds a letter or a picture. */
function richHasContent(doc: unknown): boolean {
  const walk = (node: unknown): boolean => {
    if (!isRec(node)) return false
    if (node.type === 'image') return true
    if (typeof node.text === 'string' && node.text.trim() !== '') return true
    return Array.isArray(node.content) && node.content.some(walk)
  }
  return walk(doc)
}

export type LayoutArrangement = 'row' | 'stack' | 'grid'
export type LayoutSpace = 'small' | 'medium' | 'large'
export type LayoutAlign = 'start' | 'center' | 'end'
export type LayoutSize = 'fill' | 'content'
export type LayoutColumns = 2 | 3 | 4

/** The most small blocks drawn in a section and in a group (the definition says the same: LAYOUT_MAX, GROUP_MAX). */
export const LAYOUT_MOST = 12
export const GROUP_MOST = 8

/** How a list of small blocks stands: the section's, or a group's. (Types, not interfaces: an item goes to <CmsBlocks> as a CmsBlock.) */
export type LayoutBox = {
  arrangement: LayoutArrangement
  space: LayoutSpace
  align: LayoutAlign
  /** The most side by side, for a grid. */
  columns: LayoutColumns
}

type ItemBase = { id: string; size: LayoutSize }
export type LayoutHeading = ItemBase & { type: 'heading'; text: string; level: 'large' | 'medium' | 'small' }
export type LayoutText = ItemBase & { type: 'text'; body: Rec & { type: string } }
export type LayoutPicture = ItemBase & {
  type: 'picture'
  image: CustomMedia
  shape: 'original' | 'landscape' | 'square' | 'portrait'
  /** The shape as a CSS `aspect-ratio`; for the original shape the picture's own, null when its size is unknown. */
  ratio: string | null
}
export type LayoutButton = ItemBase & { type: 'button'; label: string; href: string }
export type LayoutSmall = LayoutHeading | LayoutText | LayoutPicture | LayoutButton
export type LayoutGroup = ItemBase & LayoutBox & { type: 'group'; items: LayoutSmall[] }
export type LayoutItem = LayoutSmall | LayoutGroup

export type LayoutPlan = LayoutBox & { items: LayoutItem[] }

const SHAPE_RATIOS = { landscape: '4 / 3', square: '1 / 1', portrait: '3 / 4' } as const

/** The picture's own shape as `aspect-ratio`, or null when its size is unknown. */
export function ownRatio(image: CustomMedia | null): string | null {
  const w = Number(image?.width)
  const h = Number(image?.height)
  return w > 0 && h > 0 ? `${Math.round(w)} / ${Math.round(h)}` : null
}

/** How a section (`group: false`) or a group (`group: true`) stands. */
export function layoutBox(block: unknown, group = false): LayoutBox {
  const b = isRec(block) ? block : {}
  const arrangement: LayoutArrangement = group ? oneOf(b.arrangement, ['stack', 'row'], 'stack') : oneOf(b.arrangement, ['row', 'stack', 'grid'], 'row')
  const columns: LayoutColumns = b.columns === '2' || b.columns === 2 ? 2 : b.columns === '4' || b.columns === 4 ? 4 : 3
  return { arrangement, space: oneOf(b.space, ['small', 'medium', 'large'], 'medium'), align: oneOf(b.align, ['start', 'center', 'end'], 'start'), columns }
}

/**
 * One small block or group, read; null when it has nothing to show, its type is unknown, or it is
 * a group inside a group (`inGroup`). `index` names it when it has no id.
 */
export function layoutItem(raw: unknown, index = 0, inGroup = false): LayoutItem | null {
  if (!isRec(raw)) return null
  const id = typeof raw.id === 'string' && raw.id !== '' ? raw.id : String(index)
  const size: LayoutSize = oneOf(raw.size, ['fill', 'content'], 'fill')
  switch (raw.type) {
    case 'heading': {
      const text = str(raw.text)
      return text ? { id, type: 'heading', size, text, level: oneOf(raw.level, ['large', 'medium', 'small'], 'medium') } : null
    }
    case 'text':
      return richHasContent(raw.body) ? { id, type: 'text', size, body: raw.body as Rec & { type: string } } : null
    case 'picture': {
      const image = media(raw.image)
      if (!image) return null
      const shape = oneOf(raw.shape, ['original', 'landscape', 'square', 'portrait'], 'original')
      return { id, type: 'picture', size, image, shape, ratio: shape === 'original' ? ownRatio(image) : SHAPE_RATIOS[shape] }
    }
    case 'button': {
      const label = str(raw.label)
      const href = str(raw.link)
      return label && href ? { id, type: 'button', size, label, href } : null
    }
    case 'group': {
      if (inGroup) return null
      const items = layoutItems(raw.items, GROUP_MOST, true) as LayoutSmall[]
      return items.length ? { id, type: 'group', size, ...layoutBox(raw, true), items } : null
    }
    default:
      return null
  }
}

/** A list of small blocks, read: at most `most` of them, those with nothing to show left out. */
export function layoutItems(list: unknown, most: number, inGroup = false): LayoutItem[] {
  return (Array.isArray(list) ? list.slice(0, most) : []).flatMap((raw: unknown, i: number) => {
    const item = layoutItem(raw, i, inGroup)
    return item ? [item] : []
  })
}

export function layoutPlan(block: unknown): LayoutPlan | null {
  const b = isRec(block) ? block : {}
  const items = layoutItems(b.items, LAYOUT_MOST)
  return items.length ? { ...layoutBox(b), items } : null
}

/** The classes of the element that holds a list of small blocks (the section's, or a group's). */
export function layoutClasses(box: LayoutBox): string[] {
  return ['kit-lay', `kit-lay-${box.arrangement}`, `kit-lay-gap-${box.space}`, `kit-lay-align-${box.align}`, ...(box.arrangement === 'grid' ? [`kit-lay-cols-${box.columns}`] : [])]
}
