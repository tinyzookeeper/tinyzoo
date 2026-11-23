// The Sports club template's own helpers: its words, what a match is (played, home, won), which
// match is the next one, how training times are written, how the squad is grouped. The content
// is in the CMS; Nuxt auto-imports what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import type { Article, Match, Page, Player, Squad, Standing } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** An article has a page of its own: /aktuality/z-borove-vezeme-tri-body. */
export const ENTRY_PAGES: EntryPage[] = [
  { kind: 'article', prefix: 'aktuality', entity: 'article', part: 'Article', descriptionField: 'summary', imageField: 'image' },
]

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `zapasy` (for `/#zapasy`). Null for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

// ── time: a match is played at a wall-clock time in the club's own zone ──

const ZONE = 'Europe/Prague'
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type DayKey = typeof DAY_KEYS[number]

/** The wall clock of an instant in the club's zone. */
function wallClock(at: number) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(at))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute') }
}

/** The instant at which the clock of Prague shows this date and time (month 1–12). */
export function pragueMoment(y: number, mo: number, d: number, h = 0, mi = 0): Date {
  const wanted = Date.UTC(y, mo - 1, d, h, mi)
  const offsetAt = (at: number) => { const w = wallClock(at); return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) - at }
  // (twice: the offset at the first guess may be the other side of a change to summer time)
  const first = wanted - offsetAt(wanted)
  return new Date(wanted - offsetAt(first))
}

/** Midnight of the day an instant falls on, in the club's zone. */
export function startOfDay(at: number): number {
  const w = wallClock(at)
  return pragueMoment(w.y, w.mo, w.d).getTime()
}

/** "14:30", the way a fixture list writes a kick-off. */
export function clock(iso: string): string {
  const w = wallClock(Date.parse(iso))
  return `${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`
}

/** "24. 10." (`dots`) or "24/10" (`slash`), without the year. */
export function dayMonth(iso: string, style: 'dots' | 'slash' = 'dots'): string {
  const w = wallClock(Date.parse(iso))
  return style === 'dots' ? `${w.d}. ${w.mo}.` : `${w.d}/${w.mo}`
}

/** "18. 10. 2026" (`dots`) or "18/10/2026" (`slash`). */
export function numericDate(iso: string, style: 'dots' | 'slash' = 'dots'): string {
  const w = wallClock(Date.parse(iso))
  return style === 'dots' ? `${w.d}. ${w.mo}. ${w.y}` : `${w.d}/${w.mo}/${w.y}`
}

/** "sobota" (`long`) or "so" (`short`). */
export function weekday(iso: string, style: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: ZONE, weekday: style }).format(new Date(iso))
}

// ── matches ──

/** A match is played once both scores are filled in. */
export const isPlayed = (m: Match): boolean => m.goalsFor != null && m.goalsAgainst != null

export type Outcome = 'V' | 'R' | 'P'

export interface Side { name: string; us: boolean; goals: number | null }

/** A match as the looks draw it: the two sides in the order of the score (home first), the outcome for the club. */
export interface MatchView {
  match: Match
  id: string
  squadId: string
  at: string
  time: string
  isHome: boolean
  played: boolean
  outcome: Outcome | null
  /** "1:3": home goals, away goals. Null until played. */
  score: string | null
  home: Side
  away: Side
  round: number | null
  opponent: string
}

export function viewOf(m: Match, clubName: string): MatchView {
  const played = isPlayed(m)
  const us = m.squad.matchName || clubName
  const ours = m.goalsFor
  const theirs = m.goalsAgainst
  const side = (name: string, isUs: boolean, goals: number | null): Side => ({ name, us: isUs, goals: played ? goals : null })
  const home = m.home ? side(us, true, ours) : side(m.opponent, false, theirs)
  const away = m.home ? side(m.opponent, false, theirs) : side(us, true, ours)
  return {
    match: m, id: m.id, squadId: m.squad.id, at: m.date, time: clock(m.date), isHome: m.home, played,
    outcome: played ? (ours! > theirs! ? 'V' : ours! < theirs! ? 'P' : 'R') : null,
    score: played ? `${home.goals}:${away.goals}` : null,
    home, away, round: m.round, opponent: m.opponent,
  }
}

/** The squad whose matches the opening follows: the first one in the editors' order. */
export const mainSquad = (squads: Squad[]): Squad | null => squads[0] ?? null

/**
 * The next match of a squad: the first match still without a score that is not before today.
 * `now` is null on the server and in the browser's first drawing (both must agree), so then the
 * first match without a score is taken; once the page is mounted the time is known and a match
 * whose day has passed without a score is skipped.
 */
export function nextMatchOf(matches: Match[], squadId: string | null | undefined, now: number | null): Match | null {
  const coming = matches.filter((m) => m.squad.id === squadId && !isPlayed(m)).sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const floor = now == null ? null : startOfDay(now)
  return coming.find((m) => floor == null || Date.parse(m.date) >= floor) ?? null
}

/** The played matches of a squad, newest first. */
export const playedOf = (matches: Match[], squadId: string | null | undefined): Match[] =>
  matches.filter((m) => m.squad.id === squadId && isPlayed(m)).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))

/** The outcomes of the last `count` played matches, oldest first: V, R, P. */
export function formOf(matches: Match[], squadId: string | null | undefined, clubName: string, count = 5): Outcome[] {
  return playedOf(matches, squadId).slice(0, count).reverse().map((m) => viewOf(m, clubName).outcome!)
}

// ── the league table ──

export interface Place {
  /** 1-based place in the table. */
  place: number
  row: Standing
}

/** The club's own row and its place; null when no row is marked as ours. */
export function ourPlace(rows: Standing[]): Place | null {
  const index = rows.findIndex((r) => r.ours)
  return index === -1 ? null : { place: index + 1, row: rows[index]! }
}

/** The place and points of a club by its name in the table. */
export function placeOfClub(rows: Standing[], name: string): Place | null {
  const index = rows.findIndex((r) => r.club.trim().toLowerCase() === name.trim().toLowerCase())
  return index === -1 ? null : { place: index + 1, row: rows[index]! }
}

// ── teams ──

const sortedTrainings = (trainings: Squad['trainings']) =>
  trainings.filter((t) => t.day && t.time).sort((a, b) => DAY_KEYS.indexOf(a.day!) - DAY_KEYS.indexOf(b.day!))

/**
 * Training times as a sentence: days that share a time are joined. `short`: "út a čt 18:00",
 * "st 18:00, pá 17:30"; `long`: "úterý a čtvrtek 18:00".
 */
export function trainingText(trainings: Squad['trainings'], w: Words, style: 'short' | 'long'): string {
  const byTime = new Map<string, string[]>()
  for (const t of sortedTrainings(trainings)) byTime.set(t.time, [...(byTime.get(t.time) ?? []), w.day[t.day!][style]])
  const join = (days: string[]) => (days.length <= 2 ? days.join(w.trainingJoin) : `${days.slice(0, -1).join(', ')}${w.trainingJoin}${days.at(-1)}`)
  return [...byTime].map(([time, days]) => `${join(days)} ${time}`).join(', ')
}

/** The days of a timetable: Monday to Friday, and a weekend day when some team trains on it. */
export function timetableDays(squads: Squad[]): DayKey[] {
  const used = new Set(squads.flatMap((s) => s.trainings.map((t) => t.day)))
  return DAY_KEYS.filter((d, i) => i < 5 || used.has(d))
}

/** A team's training times by day, for a timetable: day → times ("18:00"). */
export const timesOn = (squad: Squad, day: DayKey): string[] => squad.trainings.filter((t) => t.day === day && t.time).map((t) => t.time)

/** The badge of a club or team where it is round: the first letters of its name, "Sokol Bezděkov" → "SB". A short prefix such as "FK" is skipped. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const real = words.filter((w, i) => !(i === 0 && words.length > 2 && w.length <= 2 && w === w.toUpperCase()))
  return (real.length > 1 ? real.slice(0, 2).map((w) => w[0]) : [real[0]?.[0], real[0]?.[1]]).filter(Boolean).join('').toUpperCase()
}

// ── the squad ──

const ROLES = ['goalkeeper', 'defender', 'midfielder', 'forward'] as const

/** The players grouped by position, goalkeepers first; each group in the editors' order. */
export function playersByRole(players: Player[]): Array<{ role: typeof ROLES[number]; players: Player[] }> {
  return ROLES.map((role) => ({ role, players: players.filter((p) => p.role === role) })).filter((g) => g.players.length)
}

/** The players the portraits above the list show: the first four that have a photograph. */
export const portraitPlayers = (players: Player[]): Player[] => players.filter((p) => p.photo).slice(0, 4)

/** "obránce, kapitán": the position and the note. */
export const playerLine = (p: Player, w: Words): string => [w.roleOne[p.role], p.note].filter(Boolean).join(', ')

// ── news and contacts ──

/** The address of an article's page. */
export const articleHref = (a: Pick<Article, 'slug'>): string => `/aktuality/${a.slug}`

/** A phone number or an e-mail address as a link: `tel:` or `mailto:`. */
export const contactHref = (contact: string): string => (contact.includes('@') ? `mailto:${contact}` : `tel:${contact.replace(/[^\d+]/g, '')}`)

// ── small splits of the owner's texts, where a design sets the parts differently ──

/** "10:15, dorost s Kamencem" → ["10:15", "dorost s Kamencem"]: what stands before the first comma, and the rest. */
export function splitComma(text: string | null | undefined): [lead: string, rest: string] {
  const t = (text ?? '').trim()
  const at = t.indexOf(', ')
  return at === -1 ? [t, ''] : [t.slice(0, at), t.slice(at + 2)]
}

/** "Stadion Na Sádkách" → ["Stadion", "Na Sádkách"]: the first word, and the rest. */
export function splitFirstWord(text: string | null | undefined): [first: string, rest: string] {
  const t = (text ?? '').trim()
  const at = t.indexOf(' ')
  return at === -1 ? [t, ''] : [t.slice(0, at), t.slice(at + 1)]
}

/** "sobota" → "Sobota". */
export const capital = (text: string): string => (text ? text[0]!.toUpperCase() + text.slice(1) : '')

/** "TJ Tatran Hořany, z. s." → "TJ Tatran Hořany": what stands before the first comma. */
export const beforeComma = (text: string | null | undefined): string => (text ?? '').split(',')[0]!.trim()
