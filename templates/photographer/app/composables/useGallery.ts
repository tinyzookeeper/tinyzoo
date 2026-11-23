// The gallery's filter, the same in every look: one category at a time, or all.

export function useTileFilter(tiles: MaybeRefOrGetter<GalleryTile[]>) {
  /** A category's id, or null for all */
  const active = ref<string | null>(null)
  const categories = computed(() => tileCategories(toValue(tiles)))
  const total = computed(() => toValue(tiles).length)
  return {
    active, categories, total,
    isShown: (tile: GalleryTile) => active.value === null || tile.category.id === active.value,
    choose: (id: string | null) => { active.value = id },
  }
}

/**
 * A list split into two rows. With an odd count one row is longer: the second by default
 * (5 → 2 + 3), the first with `longer: 'first'` (5 → 3 + 2). Three or fewer stay in one row.
 */
export function twoRows<T>(items: T[], longer: 'first' | 'second' = 'second'): T[][] {
  if (items.length <= 3) return [items]
  const first = longer === 'first' ? Math.ceil(items.length / 2) : Math.floor(items.length / 2)
  return [items.slice(0, first), items.slice(first)]
}
