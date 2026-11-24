// What the Studio's blocks draw from: the collections, the facts of Site settings, the visitor's
// clock and the state the timetable shares with the opening and the sign-up form.
// (The site-wide content, the page and `useSiteList` are the template kit's.)
import type { SiteForm } from '#imports'
import type { Course, Instructor, Lesson, LessonKind, Question, Tariff } from '~/lib/cms-content'

const byPosition = <T extends { position: number | null }>(list: T[]): T[] => [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

/** The kinds of classes, in the editors' order. */
export async function useKinds() {
  const list = await useSiteList<LessonKind>('site-kinds', 'lessonKind')
  return computed(() => byPosition(list.value))
}
/** Every lesson of the week (the timetable puts them in order: see `slotsOf`). */
export const useLessons = () => useSiteList<Lesson>('site-lessons', 'lesson')
/** The instructors, in the editors' order. */
export async function useInstructors() {
  const list = await useSiteList<Instructor>('site-instructors', 'instructor')
  return computed(() => byPosition(list.value))
}
/** The courses, in the editors' order. */
export async function useCourses() {
  const list = await useSiteList<Course>('site-courses', 'course')
  return computed(() => byPosition(list.value))
}
/** The prices, in the editors' order. */
export async function useTariffs() {
  const list = await useSiteList<Tariff>('site-tariffs', 'tariff')
  return computed(() => byPosition(list.value))
}
/** The questions, in the editors' order. */
export async function useQuestions() {
  const list = await useSiteList<Question>('site-questions', 'question')
  return computed(() => byPosition(list.value))
}

/** The week's classes with their kinds and instructors worked out, and the kinds in order. */
export async function useLessonSlots() {
  // (both asked for before the first wait: after one, Nuxt no longer knows which request this is)
  const [lessons, kinds] = await Promise.all([useLessons(), useKinds()])
  return { slots: computed(() => slotsOf(lessons.value, kinds.value)), kinds }
}

/** The studio as the looks write it: the settings, the address in lines, the header's button. */
export async function useStudio() {
  const { settings, name } = await useSite()
  const words = useSiteWords()
  return {
    settings, name, words,
    /** "397 01 Písek" */
    town: computed(() => [settings.value?.zip, settings.value?.city].filter(Boolean).join(' ')),
    /** "Tkalcovská 7, Písek": the street and the town, for a short line. */
    short: computed(() => [settings.value?.street, settings.value?.city].filter(Boolean).join(', ')),
    /** The phone as a link. */
    tel: computed(() => (settings.value?.phone ? telHref(settings.value.phone) : '')),
    /** The header's button: its text and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, long: settings.value.ctaLongLabel || settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null)),
    hours: computed(() => linesOfText(settings.value?.hours)),
    /** "© 2026 Studio Osnova s.r.o. · IČO 12345678": the line at the very bottom. */
    legalLine: computed(() => `© ${new Date().getFullYear()}${settings.value?.legalName ? ` ${settings.value.legalName}` : ''}${settings.value?.companyId ? ` · IČO ${settings.value.companyId}` : ''}`),
  }
}

let ticking = false

/**
 * The visitor's clock: null on the server and in the browser's first drawing, so both draw the
 * same, then the moment of the visit, renewed every minute. Everything that depends on today or
 * on what is on next reads it. In development `?now=2026-11-23T10:30` fixes it for testing.
 */
export function useNow() {
  const now = useState<number | null>('studio-now', () => null)
  const route = useRoute()
  onMounted(() => {
    const fixed = import.meta.dev && typeof route.query.now === 'string' ? Date.parse(route.query.now) : Number.NaN
    const tick = () => { now.value = Number.isNaN(fixed) ? Date.now() : fixed }
    tick()
    if (!ticking) { ticking = true; setInterval(tick, 60_000) }
  })
  return computed(() => (now.value == null ? null : new Date(now.value)))
}

/** The week of the visit: the dates of the six days and where today is; null until the page is mounted. */
export function useWeek() {
  const now = useNow()
  const week = computed(() => (now.value ? weekOf(now.value) : null))
  return { now, week }
}

interface TimetableState {
  kind: string
  level: '' | LevelId
  free: boolean
  day: DayId
  view: 'day' | 'week'
  /** The days that are open on a phone (Deka) */
  open: DayId[]
  /** Whether the visitor chose a day: until then it follows today. */
  touched: boolean
}

/**
 * The timetable's filters and the day it shows, shared by every block of the page: the kinds'
 * links, the opening's next class and the timetable itself. Until the visitor chooses, the day
 * is today (Monday on a Sunday); the server and the first drawing show Monday.
 */
export function useTimetable(slots: MaybeRefOrGetter<Slot[]>) {
  const state = useState<TimetableState>('studio-timetable', () => ({ kind: '', level: '', free: false, day: 'po', view: 'day', open: ['po'], touched: false }))
  const { now, week } = useWeek()
  watchEffect(() => {
    if (state.value.touched || !week.value) return
    const day = DAY_IDS[Math.max(0, week.value.todayIndex)]!
    state.value.day = day
    state.value.open = [day]
  })
  const match = (s: Slot) => {
    const st = state.value
    if (st.kind && s.kindId !== st.kind) return false
    if (st.level && s.level !== st.level && s.level !== 'v') return false
    if (st.free && s.free <= 0) return false
    return true
  }
  const matching = computed(() => new Set(toValue(slots).filter(match).map((s) => s.id)))
  const perDay = computed(() => {
    const out: Record<string, number> = {}
    for (const s of toValue(slots)) if (matching.value.has(s.id)) out[s.day] = (out[s.day] ?? 0) + 1
    return out
  })
  return {
    state, now, week, matching, perDay,
    total: computed(() => matching.value.size),
    /** The day the visitor chose (stops following today). */
    setDay(day: DayId) { state.value.touched = true; state.value.day = day },
    setKind(kind: string) { state.value.kind = kind },
    /** A kind's link: filter by it, open the days that have it. */
    showKind(kind: string) {
      state.value.touched = true
      state.value.kind = kind
      const list = toValue(slots).filter((s) => !kind || s.kindId === kind)
      state.value.open = DAY_IDS.filter((d) => list.some((s) => s.day === d))
      const first = list[0]
      if (first && !list.some((s) => s.day === state.value.day)) state.value.day = first.day
    },
    toggleOpen(day: DayId) {
      state.value.touched = true
      state.value.open = state.value.open.includes(day) ? state.value.open.filter((d) => d !== day) : [...state.value.open, day]
    },
  }
}

/** The class a visitor tapped: the sign-up form fills in with it and its next dates. */
export const useTrialPick = () => useState<string>('studio-pick', () => '')

/** A class as a tap on it chooses it: only a class with a place left can be. */
export function pickSlot(slot: Slot): void {
  if (slot.free > 0) useTrialPick().value = slot.id
}

/** The sign-up form's send: the consent has to be ticked first. */
export function submitTrial(form: SiteForm, message: string): void {
  if (!form.values.consent) { form.errors.consent = message; return }
  delete form.errors.consent
  form.submit()
}

/** Show the timetable: scroll to it, or go to the page that holds it when this page has none. */
export async function showTimetable(): Promise<void> {
  const id = anchorOf('timetable')
  const el = id ? document.getElementById(id) : null
  if (el) el.scrollIntoView()
  else await navigateTo(`/rozvrh${id ? `#${id}` : ''}`)
}
