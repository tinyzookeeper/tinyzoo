import { sql } from 'tinyzoo'

// Sorting text the way people of a language expect it: in Czech "Č" comes after
// "C" (not after "Z", as plain byte order puts it), "ch" after "h". Postgres does it
// with its ICU collations ("cs-x-icu"); a server built without ICU has none, and then
// the list sorts as before.
// Per site: sites may be on different database servers.
const available = cmsSiteScoped<Promise<Set<string>> | null>(() => null)

function icuCollations(db: any): Promise<Set<string>> {
  if (!available()) {
    available.set(db.execute(sql`select collname from pg_collation where collprovider = 'i'`)
      .then((res: any) => new Set<string>((res.rows ?? res).map((r: any) => r.collname)))
      .catch(() => new Set<string>()))
  }
  return available()!
}

const TEXT = new Set(['PgText', 'PgVarchar', 'PgChar'])

/** The column to order by, with the language's collation when it is text and the
 *  database has one (`lang`: "cs", "en-GB"…). */
export async function collated(db: any, col: any, lang: string | null | undefined) {
  if (!lang || !TEXT.has(col?.columnType)) return col
  const names = await icuCollations(db)
  const base = lang.split('-')[0]!
  const name = [`${lang}-x-icu`, `${base}-x-icu`].find((n) => names.has(n))
  // The name comes from the database's own list, never straight from the request.
  return name ? sql`${col} collate ${sql.identifier(name)}` : col
}
