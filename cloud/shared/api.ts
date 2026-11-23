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
  /** The way into its admin through the account: the site sends the browser to the account and gets it back signed in. */
  adminUrl: string | null
  /** Its admin's own address, with the site's own sign-in (an e-mail and a password of that site). */
  adminPasswordUrl: string | null
  steps: Step[]
  /** Technical detail of a failure. Only in development. */
  errorDetail: string | null
  /** The link where the owner may choose a password for this site's admin (the second way in); null once they have been in. */
  inviteUrl: string | null
  /** The link is older than an invitation lasts: a new one must be made. */
  inviteExpired: boolean
  ownerAccepted: boolean
  createdAt: string
  readyAt: string | null
}

export interface SiteRuntime { running: boolean; memoryBytes: number | null }

/** A website somebody runs themselves, connected to their account so its admin opens through the account. */
export interface ConnectedSiteView {
  /** Its client id at the account service. */
  id: string
  name: string
  url: string
  adminUrl: string
  createdAt: string
}

/** Another owner's website the person signed in to through the account. */
export interface MemberSiteView {
  id: string
  name: string
  url: string
  /** The role the website last reported for the person; null until it has. */
  role: string | null
  adminUrl: string
}

/** What a website is given to sign people in through the account. The secret is shown once. */
export interface ClientCredentials { issuer: string; clientId: string; clientSecret: string }

/** "My websites": the person's own, the ones they connected, and the ones of others they may edit. */
export interface SitesView {
  sites: SiteView[]
  max: number
  connected: ConnectedSiteView[]
  member: MemberSiteView[]
}

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
