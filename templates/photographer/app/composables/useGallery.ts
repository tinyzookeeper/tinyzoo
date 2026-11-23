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

/** A list split into two rows, the second the longer when the count is odd: 5 → 2 + 3, 6 → 3 + 3. */
export function twoRows<T>(items: T[]): T[][] {
  if (items.length <= 3) return [items]
  const first = Math.floor(items.length / 2)
  return [items.slice(0, first), items.slice(first)]
}
