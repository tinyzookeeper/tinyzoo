// What the kit reads from a section's block before it draws it (the three blocks of kitSections()):
// Text and picture, Cards, Questions. Plain functions of their arguments, so the unit specs test
// them without Nuxt (test/unit/template-kit-sections.spec.ts). (Only type imports: the file is loaded outside Nuxt.)
//
// An empty or unknown value is the default, as the choices of the entries blocks are read
// (customBlockPlan): a block saved before a choice existed is drawn as a new one. A section with
// nothing in it gives null, and nothing is drawn.
import type { CustomCard, CustomColumns, CustomMedia, CustomPicture } from './customTypes'

type Rec = Record<string, any>
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const media = (v: unknown): CustomMedia | null => (isRec(v) && typeof v.url === 'string' && v.url !== '' ? (v as CustomMedia) : null)

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

/** The settings every section has. */
export function sectionLook(block: unknown): { narrow: boolean; close: boolean } {
  const b = isRec(block) ? block : {}
  return { narrow: b.width === 'narrow', close: b.close === true }
}

export interface TextPicturePlan {
  heading: string
  /** The rich text, or null when it is empty. */
  body: (Rec & { type: string }) | null
  image: CustomMedia | null
  /** Only when it has both a text and a link. */
  button: { label: string; href: string } | null
  side: 'right' | 'left'
  size: 'half' | 'third'
  /** The picture's shape as a CSS `aspect-ratio`, kept between 4 / 5 and 2 / 1; null when its size is unknown. */
  ratio: string | null
}

/** The picture's width over its height as `aspect-ratio`, kept between upright (4 / 5) and wide (2 / 1). */
export function pictureRatio(image: CustomMedia | null): string | null {
  const w = Number(image?.width)
  const h = Number(image?.height)
  if (!(w > 0) || !(h > 0)) return null
  const r = Math.min(2, Math.max(4 / 5, w / h))
  return r === 2 ? '2 / 1' : r === 4 / 5 ? '4 / 5' : String(Math.round(r * 1000) / 1000)
}

export function textPicturePlan(block: unknown): TextPicturePlan | null {
  const b = isRec(block) ? block : {}
  const heading = str(b.heading)
  const body = richHasContent(b.body) ? (b.body as Rec & { type: string }) : null
  const image = media(b.image)
  const label = str(b.buttonLabel)
  const href = str(b.buttonLink)
  const button = label && href ? { label, href } : null
  if (!heading && !body && !image && !button) return null
  return { heading, body, image, button, side: b.side === 'left' ? 'left' : 'right', size: b.size === 'third' ? 'third' : 'half', ratio: pictureRatio(image) }
}

export interface CardsPlan {
  heading: string
  text: string
  columns: CustomColumns
  picture: CustomPicture
  cards: CustomCard[]
}

export function cardsPlan(block: unknown): CardsPlan | null {
  const b = isRec(block) ? block : {}
  const heading = str(b.heading)
  const text = str(b.text)
  const cards: CustomCard[] = (Array.isArray(b.items) ? b.items : []).flatMap((item: unknown, i: number) => {
    if (!isRec(item)) return []
    const title = str(item.title)
    if (!title) return []
    return [{ id: String(item.id ?? i), title, href: str(item.link) || null, image: media(item.image), meta: '', text: str(item.text), more: [] }]
  })
  if (!heading && !text && !cards.length) return null
  const columns: CustomColumns = b.columns === '2' || b.columns === 2 ? 2 : b.columns === '4' || b.columns === 4 ? 4 : 3
  const picture: CustomPicture = b.picture === 'square' || b.picture === 'portrait' ? b.picture : 'landscape'
  return { heading, text, columns, picture, cards }
}

export interface QuestionsPlan {
  heading: string
  text: string
  open: boolean
  items: { id: string; question: string; answer: string }[]
}

export function questionsPlan(block: unknown): QuestionsPlan | null {
  const b = isRec(block) ? block : {}
  const items = (Array.isArray(b.items) ? b.items : []).flatMap((item: unknown, i: number) => {
    if (!isRec(item)) return []
    const question = str(item.question)
    return question ? [{ id: String(item.id ?? i), question, answer: str(item.answer) }] : []
  })
  if (!items.length) return null
  return { heading: str(b.heading), text: str(b.text), open: b.answers === 'open', items }
}
