// The dates of the demo: the event is some months ahead of the day the seed runs, on a Saturday,
// so the demo never shows a past event; everything else is counted from it. (By hand,
// `SEED_EVENT_DATE=2027-05-22` pins the day, for comparing the site with a design.)

const MONTH_OF = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince']
// "každou druhou květnovou sobotu": the adjective of the month, accusative feminine
const MONTH_ADJECTIVE = ['lednovou', 'únorovou', 'březnovou', 'dubnovou', 'květnovou', 'červnovou', 'červencovou', 'srpnovou', 'zářijovou', 'říjnovou', 'listopadovou', 'prosincovou']
const NTH = ['první', 'druhou', 'třetí', 'čtvrtou', 'pátou']
const DAY = 86_400_000

/** A calendar day, held as noon UTC so that adding days never trips over a change of the clocks. */
const noon = (y: number, m: number, d: number) => Date.UTC(y, m, d, 12)

/** The moment a wall-clock time of the Prague time zone is, as an ISO string. */
export function pragueMoment(day: Date, hour = 0, minute = 0): string {
  const y = day.getUTCFullYear()
  const m = day.getUTCMonth()
  const d = day.getUTCDate()
  for (const offset of [1, 2]) {
    const at = new Date(Date.UTC(y, m, d, hour - offset, minute))
    const shown = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: 'numeric', hourCycle: 'h23' }).format(at)
    if (Number(shown) === hour) return at.toISOString()
  }
  return new Date(Date.UTC(y, m, d, hour - 1, minute)).toISOString()
}

export interface EventDates {
  /** The day of the start. */
  event: Date
  /** The first day of the dearer fee period is after this one; the others are counted back from the event. */
  early: Date
  spring: Date
  refund: Date
  registrationCloses: string
  start: string
  earlyIso: string
  springIso: string
  /** Days before today. */
  ago: (days: number) => string
  /** The words of the demo that follow from the dates: `{eventDate}` and so on (texts/cs.ts). */
  tokens: Record<string, string>
}

export function eventDates(now = new Date(), pinned = process.env.SEED_EVENT_DATE): EventDates {
  let event: Date
  if (pinned && /^\d{4}-\d{2}-\d{2}$/.test(pinned)) {
    const [y, m, d] = pinned.split('-').map(Number)
    event = new Date(noon(y!, m! - 1, d!))
  }
  else {
    // the first Saturday at least 150 days from today
    let t = noon(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + 150 * DAY
    while (new Date(t).getUTCDay() !== 6) t += DAY
    event = new Date(t)
  }
  const plus = (days: number) => new Date(event.getTime() + days * DAY)
  const long = (d: Date) => `${d.getUTCDate()}. ${MONTH_OF[d.getUTCMonth()]}`
  const short = (d: Date) => `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`
  const prev = plus(-364)
  const early = plus(-83)
  const spring = plus(-6)
  const refund = plus(-22)
  return {
    event, early, spring, refund,
    start: pragueMoment(event, 10),
    registrationCloses: pragueMoment(plus(-2), 20),
    earlyIso: pragueMoment(early),
    springIso: pragueMoment(spring),
    ago: (days) => pragueMoment(new Date(noon(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - days * DAY)),
    tokens: {
      eventDate: `${long(event)} ${event.getUTCFullYear()}`,
      eventDay: long(event),
      eventShort: short(event),
      weekdayShort: `sobota ${short(event)}`,
      year: String(event.getUTCFullYear()),
      early: long(early),
      earlyShort: short(early),
      spring: long(spring),
      refund: long(refund),
      prevDate: `${long(prev)} ${prev.getUTCFullYear()}`,
      prevYear: String(prev.getUTCFullYear()),
      archiveTo: String(prev.getUTCFullYear() - 1),
      nth: NTH[Math.ceil(event.getUTCDate() / 7) - 1]!,
      monthAdj: MONTH_ADJECTIVE[event.getUTCMonth()]!,
    },
  }
}

/** The text with its `{token}`s filled in, in every string of the object. Unknown ones (the page's own, `{total}`) stay. */
export function fillTokens<T>(value: T, tokens: Record<string, string>): T {
  if (typeof value === 'string') return value.replace(/\{(\w+)\}/g, (all, key: string) => tokens[key] ?? all) as T
  if (Array.isArray(value)) return value.map((v) => fillTokens(v, tokens)) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillTokens(v, tokens)])) as T
  return value
}
