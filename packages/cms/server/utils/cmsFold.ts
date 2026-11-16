import { foldSearchText, sql } from 'tinyzoo'

// Search that ignores letter case and accents ("zimni" finds "Zimní"), without a
// database extension: both sides lowercased, accented letters replaced by plain ones.
// (Czech, Slovak, German, Polish, Hungarian, Romanian, Croatian and the like.)
const ACCENTED = 'áàâäãåčćçďéèêëěíìîïľĺłňńñóòôöõőřŕšśťúùûüůűýÿžźżąęășşțţđ'
const PLAIN = 'aaaaaacccdeeeeeiiiilllnnnoooooorrsstuuuuuuyyzzzaeassttd'

/** The search text, folded the same way as the column. */
export function foldAccents(text: string): string {
  return foldSearchText(text)
}

/** A text column, lowercased and without accents (for `like`). */
export function foldedColumn(col: any) {
  return sql`translate(lower(cast(${col} as text)), ${ACCENTED}, ${PLAIN})`
}
