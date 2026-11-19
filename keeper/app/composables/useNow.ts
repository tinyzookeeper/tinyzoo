/**
 * The current time for "3 min ago" and countdowns. The server's moment is carried into the
 * page, so the browser's first render says the same as the server's (no hydration
 * mismatch); after that it follows the browser's clock, every 30 s.
 */
export function useNow() {
  const now = useState('keeper-now', () => Date.now())
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    now.value = Date.now()
    timer = setInterval(() => { now.value = Date.now() }, 30_000)
  })
  onBeforeUnmount(() => clearInterval(timer))
  return now
}
