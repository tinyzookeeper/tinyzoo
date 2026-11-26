/**
 * The classes of the site's look's main button, for the kit's sections: what the look's definition
 * says (`button`), `btn` when it says nothing, and none (an empty string) for a look that has no
 * `.btn` of its own; the section then draws a plain link.
 */
export async function useLookButton() {
  const { look } = await useSite()
  return computed(() => (look.value.look as { button?: string }).button ?? 'btn')
}
