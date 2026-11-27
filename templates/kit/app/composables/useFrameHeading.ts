import type { ComponentPublicInstance, Ref } from 'vue'

/**
 * Marks the heading of a kit's section for the editor in the preview (cmsField('heading')), so it is typed
 * right in the page. The look's own Text part draws that heading, so the kit finds it in the part's
 * element after it is drawn (frameHeading): no look has to know of the editor. Only while an editor
 * works on the page (useCmsEditing()); nothing on the live site.
 */
export function useFrameHeading(frame: Ref<ComponentPublicInstance | null>, body: Ref<HTMLElement | null>) {
  const editing = useCmsEditing()
  function mark() {
    if (!editing.value) return
    const root = frame.value?.$el as Node | null | undefined
    const heading = root instanceof Element ? frameHeading(root, body.value) : null
    if (!heading) return
    for (const [name, value] of Object.entries(cmsField('heading'))) heading.setAttribute(name, value)
  }
  onMounted(mark)
  onUpdated(mark)
  watch(editing, () => nextTick(mark))
}
