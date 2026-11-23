import type { Step } from './steps'
import type { Locale } from './templates'

export type SiteStatus = 'waiting' | 'creating' | 'ready' | 'failed' | 'removing' | 'removed'

/** A website as its owner sees it. Never holds a secret; the invitation link goes only to the owner. */
export interface SiteView {
  id: string
  name: string
  slug: string
  template: string
  /** The site's look: the one chosen when it was made, then whatever its owner set in its admin (the site's page asks the site). Null for a template with one design. */
  look: string | null
  status: SiteStatus
  /** The website's address, once it has one. */
  publicUrl: string | null
  /** Its admin's address. */
  adminUrl: string | null
  steps: Step[]
  /** Technical detail of a failure. Only in development. */
  errorDetail: string | null
  /** The link where the owner chooses a password for the admin; null once they have. */
  inviteUrl: string | null
  ownerAccepted: boolean
  createdAt: string
  readyAt: string | null
}

export interface SiteRuntime { running: boolean; memoryBytes: number | null }

export interface AccountView {
  user: { id: string; name: string; email: string; locale: Locale; emailVerified: boolean } | null
  /** How many websites the account has and may have. */
  sites: { used: number; max: number }
  /** Whether a website is made only after the e-mail is confirmed. */
  requireVerifiedEmail: boolean
  /** Development only (e-mail is printed, not sent): the last confirmation link, to open by hand. */
  devVerifyUrl: string | null
  /** What follows a site's address on this host: ".localhost" locally (or what NUXT_HOSTING_LOCAL_PUBLIC_URL says), ".pushbase.app" on Pushbase. */
  siteHost: string
}

export interface SlugCheck {
  slug: string
  ok: boolean
  /** 'taken', or what is wrong with its shape. */
  problem: string | null
  /** A free address close to it, when it is taken. */
  suggestion: string | null
}
