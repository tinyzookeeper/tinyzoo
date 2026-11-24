// Návod numbers its figures down the page ("Obr. 2"): the opening's screen is the first when it
// has one, then each feature's, then the photograph of the team. The number of the first one is
// worked out here from what the page holds.

/** How many figures come before the features': 1 when the opening shows a screen, else 0. */
export async function useFiguresBefore() {
  const sections = await usePageSections()
  return computed(() => {
    const opening = sections.value.find((s) => s.type === 'opening')
    return opening && (opening.image || opening.screen !== 'none') ? 1 : 0
  })
}
