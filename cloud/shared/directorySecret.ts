// The secrets of a row of the site directory, as tinyzoo reads them
// (packages/cms/server/utils/cmsSite.ts): `enc:v1:` + base64url(iv 12 | tag 16 | ciphertext),
// AES-256-GCM, with the SHA-256 of the directory key as the key. Written here, by the side
// that writes the directory; a unit spec holds a fixed vector both sides agree on.
//
// Server only (node:crypto): the shared driver and its specs.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { SharedSiteRow } from './sharedHosting'

export const DIRECTORY_SECRET_PREFIX = 'enc:v1:'

/** The directory key from settings: empty (no encryption) or at least 32 characters. */
export function directoryKey(value: unknown): string {
  const key = String(value ?? '')
  if (key && key.length < 32) throw new Error('The directory key (NUXT_HOSTING_SHARED_DIRECTORY_KEY) must be at least 32 characters')
  return key
}

const keyBytes = (key: string): Buffer => {
  if (key.length < 32) throw new Error('The directory key must be at least 32 characters')
  return createHash('sha256').update(key, 'utf8').digest()
}

export const isDirectorySecret = (value: unknown): value is string => typeof value === 'string' && value.startsWith(DIRECTORY_SECRET_PREFIX)

/** Encrypt one secret. `iv` is for the spec's fixed vector only: every real call takes 12 new random bytes. */
export function encryptDirectorySecret(plain: string, key: string, iv: Buffer = randomBytes(12)): string {
  if (iv.length !== 12) throw new Error('The iv must be 12 bytes')
  const cipher = createCipheriv('aes-256-gcm', keyBytes(key), iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return DIRECTORY_SECRET_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')
}

/** The plain text of a secret; a text that is not encrypted comes back as it is. Throws when the key is wrong or the text damaged. */
export function decryptDirectorySecret(value: string, key: string): string {
  if (!isDirectorySecret(value)) return value
  const raw = Buffer.from(value.slice(DIRECTORY_SECRET_PREFIX.length), 'base64url')
  if (raw.length < 28) throw new Error('The secret is damaged')
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(key), raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
}

/** Every secret of a row, laid over it by `change`: the database address (it holds the password), the site's secret and the tokens inside its settings. */
function withSecrets(row: SharedSiteRow, change: (secret: string) => string): SharedSiteRow {
  const account = row.config.auth.account
  return {
    ...row,
    databaseUrl: change(row.databaseUrl),
    secret: change(row.secret),
    config: {
      ...row.config,
      auth: {
        ...row.config.auth,
        setupToken: row.config.auth.setupToken ? change(row.config.auth.setupToken) : row.config.auth.setupToken,
        ...(account ? { account: { ...account, clientSecret: change(account.clientSecret) } } : {}),
      },
      status: { ...row.config.status, token: row.config.status.token ? change(row.config.status.token) : row.config.status.token },
    },
  }
}

/** A row as the directory stores it: no password, secret or token in plain text. Without a key the row is stored as it is. */
export function encryptSiteRow(row: SharedSiteRow, key: string): SharedSiteRow {
  return key ? withSecrets(row, (secret) => (isDirectorySecret(secret) ? secret : encryptDirectorySecret(secret, key))) : row
}

/** A stored row as the driver works with it. Throws when a secret cannot be read with this key. */
export function decryptSiteRow(row: SharedSiteRow, key: string): SharedSiteRow {
  return withSecrets(row, (secret) => {
    if (!isDirectorySecret(secret)) return secret
    if (!key) throw new Error('The row is encrypted, and no directory key is set')
    return decryptDirectorySecret(secret, key)
  })
}
