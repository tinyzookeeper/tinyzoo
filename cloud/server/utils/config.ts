import type { H3Event } from 'h3'

const flag = (v: unknown, fallback: boolean) => (v === undefined || v === null || v === '' ? fallback : String(v) === 'true')

/** Whether a website is made only after the e-mail is confirmed: NUXT_REQUIRE_VERIFIED_EMAIL, else off in development and on in production. */
export function requireVerifiedEmail(): boolean {
  return flag(useRuntimeConfig().requireVerifiedEmail, !import.meta.dev)
}

export function maxSitesPerUser(): number {
  const n = Number(useRuntimeConfig().maxSitesPerUser)
  return Number.isInteger(n) && n > 0 ? n : 3
}

/** The cloud's own address without a trailing slash: NUXT_PUBLIC_URL, else where the request came to. */
export function publicUrl(event?: H3Event): string {
  const configured = String(useRuntimeConfig().publicUrl || '').replace(/\/+$/, '')
  if (configured) return configured
  return event ? getRequestURL(event).origin : 'http://localhost:3200'
}

/** The account the cloud keeps on every website. */
export function serviceEmail(): string {
  return String(useRuntimeConfig().serviceEmail || 'cloud@tinyzoo.invalid').trim().toLowerCase()
}

/**
 * E-mail is only printed (NUXT_MAIL_TRANSPORT=log) and this is a development server: pages may
 * show the links instead. NUXT_DEV_MAIL_LINKS=false keeps the pages as a customer sees them
 * (the recorded walkthrough).
 */
export function showsMailLinks(): boolean {
  return import.meta.dev && (useRuntimeConfig().mail as any)?.transport !== 'smtp' && String(useRuntimeConfig().devMailLinks) !== 'false'
}
