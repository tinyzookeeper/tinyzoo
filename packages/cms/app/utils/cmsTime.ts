// Wall-clock time in a named time zone <-> an instant. The admin shows and edits
// dates in its configured zone (cms.admin.timeZone), never the server's or the
// browser's, so "9:00" means 9:00 in Prague for every editor and every server.

function partsIn(ts: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ts))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') }
}

/** How far `timeZone` is ahead of UTC at instant `ts`, in ms (DST-aware). */
function offsetAt(ts: number, timeZone: string): number {
  const p = partsIn(ts, timeZone)
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ts / 1000) * 1000
}

const pad = (n: number) => String(n).padStart(2, '0')

/** An instant → `YYYY-MM-DDTHH:mm` as the wall clock reads in `timeZone` (for <input type="datetime-local">). */
export function toZonedInput(value: string | number | Date | null | undefined, timeZone: string): string {
  if (value === null || value === undefined || value === '') return ''
  const ts = new Date(value).getTime()
  if (Number.isNaN(ts)) return ''
  const p = partsIn(ts, timeZone)
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`
}

/** `YYYY-MM-DDTHH:mm` read as wall-clock time in `timeZone` → ISO instant (UTC). Empty → null. */
export function fromZonedInput(input: string | null | undefined, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(input ?? '')
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as [never, number, number, number, number, number]
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  // Two passes settle the offset across a DST change.
  let ts = guess - offsetAt(guess, timeZone)
  ts = guess - offsetAt(ts, timeZone)
  return new Date(ts).toISOString()
}
