import { grantedIn, type ConsentCookie } from '../../consent/core/cookie'
import type { AnalyticsMode } from '../options'

/**
 * What a page view does with the visitor's cookie choice (the consent plugin's cookie, read by
 * the endpoint; `choice` is null without one that still holds):
 *  - `cookieless`: counted, and the cookie is not looked at;
 *  - `consent`: counted; the consent id is kept with the view only if statistics are allowed;
 *  - `strict`: counted only if statistics are allowed, and never with the consent id.
 * The headline numbers count the day's hash in every mode, so nobody is counted twice.
 */
export function consentDecision(mode: AnalyticsMode, choice: Pick<ConsentCookie, 'id' | 'choice'> | null): { count: boolean; consentId: string | null } {
  if (mode === 'cookieless') return { count: true, consentId: null }
  const granted = grantedIn(choice?.choice, 'analytics')
  if (mode === 'strict') return { count: granted, consentId: null }
  return { count: true, consentId: granted && choice ? choice.id : null }
}
