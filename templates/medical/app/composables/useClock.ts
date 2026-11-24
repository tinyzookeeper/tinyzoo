// "Now" on the practice's wall clock, for everything that depends on the visitor's time: today's
// row, "open right now", tomorrow's hours, the clock's hands, which notices are valid.
//
// The server cannot know when the page is looked at (and a cached page is looked at much later),
// so it answers with `null` and the looks draw a neutral version; the browser fills the moment
// in after it has drawn the same neutral page, so nothing differs between the two. The moment is
// then kept up to date every half minute.
//
// In development only (never in a built site), `?now=2026-11-25T09:40` in the address fixes
// the moment (the wall clock of the practice's town): what the comparisons with the designs use.
import type { Moment } from '~/utils/site'

let timer: ReturnType<typeof setInterval> | undefined
let users = 0

export function useClock() {
  const route = useRoute()
  const now = useState<Moment | null>('medical-clock', () => null)
  const fixed = computed(() => (import.meta.dev && typeof route.query.now === 'string' ? momentFromText(route.query.now) : null))
  onMounted(() => {
    now.value = fixed.value ?? momentFromDate(new Date())
    if (fixed.value) return
    users++
    if (users === 1) timer = setInterval(() => { now.value = momentFromDate(new Date()) }, 30_000)
  })
  onBeforeUnmount(() => {
    if (fixed.value || !import.meta.client) return
    users = Math.max(0, users - 1)
    if (!users && timer) { clearInterval(timer); timer = undefined }
  })
  return now
}
