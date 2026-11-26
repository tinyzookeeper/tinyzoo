/**
 * The classes of the heading of the look's own sections (its Text part, when the section is not the first
 * block of the page): what the look's definition says (`heading`), for a large heading of a Layout
 * section (KitLayoutHeading). An empty string for a look that says nothing; the heading is then the
 * look's text `h2`.
 */
export async function useLookHeading() {
  const { look } = await useSite()
  return computed(() => (look.value.look as { heading?: string }).heading ?? '')
}
