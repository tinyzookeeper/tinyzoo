// The Studio template's own helpers: its words, the timetable's arithmetic (days, times, what
// is on next) and which photographs each look takes. The content is in the CMS; Nuxt
// auto-imports what is exported here. (Addresses, prices and dates are the template kit's:
// templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import type { CmsMedia, Lesson, LessonKind, Page } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** Every address is a page built from blocks: the classes, courses and instructors are lists on a page, not pages of their own. */
export const ENTRY_PAGES: EntryPage[] = []

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on a page: `rozvrh` (for `/#rozvrh`). Null for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

// ── the week ──

/** The days of the timetable, Monday to Saturday (Sunday is closed). */
export const DAY_IDS = ['po', 'ut', 'st', 'ct', 'pa', 'so'] as const
export type DayId = typeof DAY_IDS[number]
export type LevelId = Lesson['level']

/** How many of the three marks of difficulty a level fills; none for "all levels" and "by age". */
export const LEVEL_MARKS: Record<LevelId, number> = { z: 1, m: 2, p: 3, v: 0, d: 0 }

/** "18:45" → 1125 minutes since midnight. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':')
  return Number(h) * 60 + Number(m ?? 0)
}

/** The part of the day a class starts in, for Sál's rows. */
export const partOf = (startMin: number): 0 | 1 | 2 => (startMin < 720 ? 0 : startMin < 1020 ? 1 : 2)

/** The rooms in the order the board draws them: the largest first (it is the upper row of a day's picture). */
export function roomsOf(slots: Slot[]): string[] {
  const size = new Map<string, number>()
  for (const s of slots) size.set(s.room, Math.max(size.get(s.room) ?? 0, s.capacity))
  return [...size.keys()].sort((a, b) => size.get(b)! - size.get(a)! || a.localeCompare(b, 'cs'))
}

/** One class of the week as the looks draw it: the lesson with its kind, its instructor and its times worked out. */
export interface Slot {
  id: string
  title: string
  day: DayId
  /** Where the day stands in the week: 0 Monday … 5 Saturday */
  dayIndex: number
  start: string
  end: string
  startMin: number
  endMin: number
  /** The kind's id and where it stands in the list of kinds (Deka's thread colour) */
  kindId: string
  kindIndex: number
  first: string
  last: string
  room: string
  level: LevelId
  capacity: number
  free: number
}

/** The timetable in order: by day, then by the time a class starts. A lesson with a day the timetable does not know is left out. */
export function slotsOf(lessons: Lesson[], kinds: LessonKind[]): Slot[] {
  const order = [...kinds].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((k) => k.id)
  return lessons
    .filter((l) => (DAY_IDS as readonly string[]).includes(l.day))
    .map((l): Slot => {
      const name = (l.instructor?.name ?? '').trim()
      const at = name.indexOf(' ')
      return {
        id: l.id, title: l.title, day: l.day, dayIndex: DAY_IDS.indexOf(l.day), start: l.start, end: l.end,
        startMin: minutesOf(l.start), endMin: minutesOf(l.end),
        kindId: l.kind?.id ?? '', kindIndex: Math.max(0, order.indexOf(l.kind?.id ?? '')),
        first: at === -1 ? name : name.slice(0, at), last: at === -1 ? '' : name.slice(at + 1),
        room: l.room, level: l.level, capacity: l.capacity, free: l.free,
      }
    })
    .sort((a, b) => a.dayIndex - b.dayIndex || a.startMin - b.startMin || a.endMin - b.endMin)
}

/** The thread (1 to 5) a kind's colour is: kinds take them in the order of their list, and start over after five. */
export const threadOf = (kindIndex: number): 1 | 2 | 3 | 4 | 5 => ((kindIndex % 5) + 1) as 1 | 2 | 3 | 4 | 5

/** A class's state by the places left: full, a few left, plenty. */
export const seatsOf = (free: number): 'full' | 'low' | 'ok' => (free <= 0 ? 'full' : free <= 2 ? 'low' : 'ok')

/** The week a visitor looks at: the six days as dates, from this Monday (on Sunday: the coming one). */
export function weekOf(now: Date): { dates: Date[]; todayIndex: number } {
  const dow = (now.getDay() + 6) % 7
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + (dow === 6 ? 7 : 0))
  return {
    dates: DAY_IDS.map((_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)),
    todayIndex: dow === 6 ? -1 : dow,
  }
}

/** "23. 11." */
export const dayMonth = (d: Date): string => `${d.getDate()}. ${d.getMonth() + 1}.`

/** The moment a class next starts: this week's, or the same one a week later when it has begun. */
export function nextStart(slot: Slot, dates: Date[], now: Date): Date {
  const day = dates[slot.dayIndex]!
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(slot.startMin / 60), slot.startMin % 60)
  if (d < now) d.setDate(d.getDate() + 7)
  return d
}

/** The class that starts next with a place left, and how many days away it is (0 today, 1 tomorrow); null before the page is mounted. */
export function nextLesson(slots: Slot[], dates: Date[] | undefined, now: Date | null | undefined): { slot: Slot; days: number } | null {
  if (!dates || !now) return null
  const up = slots.filter((s) => s.free > 0).map((s) => ({ s, d: nextStart(s, dates, now) })).sort((a, b) => a.d.getTime() - b.d.getTime())[0]
  if (!up) return null
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return { slot: up.s, days: Math.round((day(up.d) - day(now)) / 864e5) }
}

/**
 * What Tabule's opening lists: today's classes, or tomorrow's once today's last one has begun
 * (on Sunday and after Saturday's last class: Monday's).
 */
export function boardOf(slots: Slot[], week: { dates: Date[]; todayIndex: number }, now: Date): { when: 'today' | 'tomorrow' | 'monday'; dayIndex: number; date: Date; slots: Slot[]; nowMin: number } {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  let index = week.todayIndex
  let when: 'today' | 'tomorrow' | 'monday' = 'today'
  let shift = 0
  if (index < 0) { index = 0; when = 'tomorrow' }
  else if (!slots.some((s) => s.dayIndex === index && s.startMin > nowMin)) {
    if (index === 5) { index = 0; shift = 7; when = 'monday' }
    else { index++; when = 'tomorrow' }
  }
  const base = week.dates[index]!
  return { when, dayIndex: index, date: new Date(base.getFullYear(), base.getMonth(), base.getDate() + shift), slots: slots.filter((s) => s.dayIndex === index), nowMin }
}

/** The week as one line: "23.–28. listopadu" (`words`) or "23. – 28. 11." (`numbers`, Tabule's). */
export function weekLabel(dates: Date[], months: string[], style: 'words' | 'numbers'): string {
  const [from, to] = [dates[0]!, dates[dates.length - 1]!]
  const sameMonth = from.getMonth() === to.getMonth()
  if (style === 'numbers') return `${from.getDate()}. ${sameMonth ? '' : `${from.getMonth() + 1}. `}– ${dayMonth(to)}`
  return sameMonth ? `${from.getDate()}.–${to.getDate()}. ${months[to.getMonth()]}` : `${from.getDate()}. ${months[from.getMonth()]} – ${to.getDate()}. ${months[to.getMonth()]}`
}

/** "2027-01-12" and "12. 1.": a date for the form's field and for the eyes. */
export const isoDate = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The parts of a heading's lines: Tabule starts a new line where the editor pressed Enter. */
export const linesOf = (text: string | null | undefined): string[] => (text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

/** "Napište na a@b.example nebo zavolejte" → text, the address, text: an e-mail address in a sentence is a link. */
export function emailParts(text: string | null | undefined): Array<{ text: string; email: boolean }> {
  const out: Array<{ text: string; email: boolean }> = []
  const source = text ?? ''
  const pattern = /[^\s@]+@[^\s@]+\.[^\s@.,;:!?)]+/g
  let at = 0
  for (let m = pattern.exec(source); m; m = pattern.exec(source)) {
    if (m.index > at) out.push({ text: source.slice(at, m.index), email: false })
    out.push({ text: m[0], email: true })
    at = m.index + m[0].length
  }
  if (at < source.length) out.push({ text: source.slice(at), email: false })
  return out
}

/** "Jóga · Zdravá záda" → ["Jóga", "Zdravá záda"]: the tags of an instructor's line. */
export const tagsOf = (label: string | null | undefined): string[] => (label ?? '').split('·').map((t) => t.trim()).filter(Boolean)

/** The lines of a multi-line setting (the hours in the footer). */
export const linesOfText = (text: string | null | undefined): string[] => (text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

/** Lucide icons for the ways of getting there. */
export const WAY_ICONS: Record<string, string> = { walk: 'i-lucide-footprints', bus: 'i-lucide-bus', car: 'i-lucide-car', bike: 'i-lucide-bike', clock: 'i-lucide-clock' }

// ── which photographs a look takes ──
type Photo = { image: CmsMedia | null }
const withImage = <T extends Photo>(items: T[] | null | undefined): Array<T & { image: CmsMedia }> => (items ?? []).filter((p): p is T & { image: CmsMedia } => !!p.image)

/** The opening's photographs: Sál the first, Tabule the second, Deka the second with the third over its corner. A missing one is the first. */
export function heroPhotos(block: BlockOf<'hero'>, look: string): { main: CmsMedia | null; small: CmsMedia | null } {
  const all = withImage(block.photos).map((p) => p.image)
  const first = all[0] ?? null
  if (look === 'sal') return { main: first, small: null }
  return { main: all[1] ?? first, small: look === 'deka' ? (all[2] ?? null) : null }
}

/** The space's three photographs, in the order the block holds them. */
export const spacePhotos = (block: BlockOf<'space'>) => withImage(block.photos)
