/**
 * How files in an S3-compatible bucket reach browsers (`cms.storage.s3.delivery`), and the
 * address a stored file gets for it. Shared by the server's storage driver and the
 * command line (`tinyzoo import` writes the same addresses), so the two cannot drift.
 * No Nitro globals: the unit tests load it.
 */

/**
 * - `public`: the bucket (or a CDN in front of it) is readable by anyone; the stored address
 *   is the bucket's own (`publicBaseUrl`, or `<endpoint>/<bucket>/<key>`).
 * - `proxy`: the bucket is private; the app streams each file (`/api/cms/_media/raw/<key>`).
 * - `redirect`: the bucket is private; the app answers with a short-lived signed address.
 * The stored address of `proxy` and `redirect` is the same app path, so it never expires.
 */
export type S3Delivery = 'public' | 'proxy' | 'redirect'
export const S3_DELIVERIES: readonly S3Delivery[] = ['public', 'proxy', 'redirect']

/** The app path files are served from when the bucket is not (the one the local driver uses). */
export const DEFAULT_MEDIA_BASE = '/api/cms/_media/raw'

/** What was asked for, or the default: `public` when a public address is given, `proxy` otherwise. Throws for a name that is none of the three. */
export function resolveS3Delivery(value: unknown, publicBaseUrl?: string | null): S3Delivery {
  const asked = String(value ?? '').trim().toLowerCase()
  if (!asked) return publicBaseUrl ? 'public' : 'proxy'
  if ((S3_DELIVERIES as readonly string[]).includes(asked)) return asked as S3Delivery
  throw new Error(`Unknown storage delivery '${asked}' (NUXT_CMS_STORAGE_S3_DELIVERY is 'public', 'proxy' or 'redirect').`)
}

/** A key as the path of an address, one segment at a time. */
export function encodeStorageKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}

/** A key that stays inside the bucket: no empty, `.` or `..` segments (a URL would resolve them), no backslash or control characters. */
export function isSafeStorageKey(key: string): boolean {
  if (!key || key.length > 1024) return false
  if (/[\\\u0000-\u001f\u007f]/.test(key)) return false
  return key.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
}

/**
 * `cms.storage.s3.prefix`: the place of a site inside a bucket it shares with others
 * (`sites/7f3a`). Path segments of `a-z`, `0-9`, `-`, `_` and `.`; no empty segment, no `.`
 * or `..`, no leading slash. One trailing slash is dropped. Empty = the bucket's root.
 * Throws an Error that names the setting for anything else.
 */
export function cleanS3Prefix(value: unknown): string {
  const asked = String(value ?? '').trim()
  if (!asked) return ''
  const prefix = asked.endsWith('/') ? asked.slice(0, -1) : asked
  const wrong = prefix.length > 200 || prefix.split('/').some((part) => !/^[a-z0-9_.-]+$/.test(part) || part === '.' || part === '..')
  if (wrong) {
    throw new Error(`Invalid storage prefix '${asked}' (cms.storage.s3.prefix, NUXT_CMS_STORAGE_S3_PREFIX): `
      + "use path segments of a-z, 0-9, '-', '_' and '.', separated by '/', for example sites/7f3a; no empty segment, no '.' or '..', no leading slash.")
  }
  return prefix
}

/** The path of an object below the bucket: the site's prefix (already clean), then its key. */
export function s3ObjectPath(prefix: string, key: string): string {
  return (prefix ? prefix + '/' : '') + key
}

/** The address a file is stored under in the database, and handed to browsers. */
export function storedMediaUrl(
  cfg: { delivery: S3Delivery; endpoint: string; bucket: string; publicBaseUrl?: string | null; appBase?: string | null; prefix?: string | null },
  key: string,
): string {
  // The stored key is the same with or without a prefix; only the bucket's own address has it.
  if (cfg.delivery !== 'public') {
    const base = (cfg.appBase || DEFAULT_MEDIA_BASE).replace(/\/+$/, '')
    return base + '/' + key
  }
  const endpoint = cfg.endpoint.replace(/\/+$/, '')
  const base = cfg.publicBaseUrl?.replace(/\/+$/, '') || endpoint + '/' + cfg.bucket
  return base + '/' + encodeStorageKey(s3ObjectPath(cfg.prefix ?? '', key))
}
