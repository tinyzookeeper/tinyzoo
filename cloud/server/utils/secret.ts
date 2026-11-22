import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// What the cloud keeps about a site (its secrets, the invitation link) is stored encrypted
// (AES-256-GCM). The key comes from
// NUXT_CLOUD_SECRET; changing it makes them unreadable.
function key(): Buffer {
  const secret = String(useRuntimeConfig().cloudSecret || '')
  if (secret.length < 32) {
    if (process.env.NODE_ENV === 'production') throw createError({ statusCode: 500, statusMessage: 'NUXT_CLOUD_SECRET must be at least 32 characters' })
    return createHash('sha256').update('tinyzoo-cloud-development-secret').digest()
  }
  return createHash('sha256').update(secret).digest()
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.')
}

/** The plain text, or null when it cannot be read (another secret, damaged). */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null
  const [v, iv, tag, data] = stored.split('.')
  if (v !== 'v1' || !iv || !tag || !data) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
  }
  catch {
    return null
  }
}
