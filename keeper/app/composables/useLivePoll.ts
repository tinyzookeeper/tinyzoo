/**
 * Refresh something every `ms` while the page is open and in view: live numbers. A hidden tab
 * stops asking, and asks once at once when it is shown again.
 */
export function useLivePoll(refresh: () => unknown, ms = 30_000, active: () => boolean = () => true) {
  let timer: ReturnType<typeof setInterval> | undefined
  const tick = () => {
    if (document.visibilityState === 'visible' && active()) refresh()
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible' && active()) refresh()
  }
  onMounted(() => {
    timer = setInterval(tick, ms)
    document.addEventListener('visibilitychange', onVisible)
  })
  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  })
}
