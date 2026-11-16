import { sql } from 'tinyzoo'

// Search that ignores letter case and accents ("zimni" finds "Zimní"), without a
// database extension: both sides lowercased, accented letters replaced by plain ones.
const ACCENTED = 'áàâäãåčćçďéèêëěíìîïľĺłňńñóòôöõőřŕšśťúùûüůűýÿžźż'
const PLAIN = 'aaaaaacccdeeeeeiiiilllnnnoooooorrsstuuuuuuyyzzz'

/** The search text, folded the same way as the column. */
export function foldAccents(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l')
}

/** A text column, lowercased and without accents (for `like`). */
export function foldedColumn(col: any) {
  return sql`translate(lower(cast(${col} as text)), ${ACCENTED}, ${PLAIN})`
}
