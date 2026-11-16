/**
 * Focus mode: while a page that needs the room is open (the Write and Preview
 * editors), the admin's sidebar folds to icons. The page calls `useCmsFocus(true)`;
 * leaving the page unfolds it again — to whatever the person chose themselves.
 */
export function useCmsFocus(on?: MaybeRefOrGetter<boolean>) {
  const focus = useState('cms-focus', () => false)
  if (on !== undefined) {
    watch(() => toValue(on), (v) => { focus.value = v }, { immediate: true })
    onBeforeUnmount(() => { focus.value = false })
  }
  return focus
}
