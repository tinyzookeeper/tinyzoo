/**
 * A phone's full-screen menu: open and closed, the page behind it held still, Escape closes
 * it, and so does going to another page.
 *
 *   const menu = useOverlayMenu()
 *   <button :aria-expanded="menu.open.value" @click="menu.show()">Menu</button>
 *   <div v-show="menu.open.value"> … <button @click="menu.hide()">Close</button> … </div>
 */
export function useOverlayMenu() {
  const open = ref(false)
  const route = useRoute()
  const show = () => { open.value = true }
  const hide = () => { open.value = false }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
  watch(open, (on) => {
    if (!import.meta.client) return
    document.body.style.overflow = on ? 'hidden' : ''
    if (on) document.addEventListener('keydown', onKey)
    else document.removeEventListener('keydown', onKey)
  })
  watch(() => route.fullPath, hide)
  onBeforeUnmount(() => {
    if (!import.meta.client) return
    document.body.style.overflow = ''
    document.removeEventListener('keydown', onKey)
  })
  return { open, show, hide }
}
