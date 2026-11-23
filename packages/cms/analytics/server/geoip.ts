import { readFile } from 'node:fs/promises'
import { Reader } from 'mmdb-lib'
import { countryCode } from '../core/enrich'

/**
 * The country of an address from a country database file (the MaxMind format, `.mmdb`), when
 * the site has one: DB-IP's "IP to Country Lite" or MaxMind's GeoLite2 Country. Read once into
 * memory (a country database is a few megabytes). The address is only looked up, never kept.
 * Without a file, or with one that cannot be read, visits simply have no country.
 */
const geo = processWide<{ loaded: { file: string; reader: Promise<Reader<any> | null> } | null }>({ loaded: null }, 'the country database is a file of the build, the same for every site')

function readerFor(file: string): Promise<Reader<any> | null> {
  if (geo.loaded?.file === file) return geo.loaded.reader
  const reader = readFile(file)
    .then((buf) => new Reader<any>(buf))
    .catch((err: any) => {
      console.warn(`[cms] analytics: the country database ${file} could not be read (${err?.code ?? err?.message ?? err}); visits get no country from it`)
      return null
    })
  geo.loaded = { file, reader }
  return reader
}

export async function countryOfAddress(file: string | null, ip: string): Promise<string | null> {
  if (!file || !ip || ip === 'unknown') return null
  const reader = await readerFor(file)
  if (!reader) return null
  try {
    const hit = reader.get(ip) as any
    return countryCode(hit?.country?.iso_code ?? hit?.registered_country?.iso_code)
  }
  catch {
    return null
  }
}
