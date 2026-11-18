import type { CmsAdminTheme } from '../../src/theme'
import type { CmsLogoSlot } from '../../src/themeLogo'

/** The logo files the browser could not load, by slot (`full`, `fullDark`, `mark`, `markDark`). */
export type CmsLogoFailures = Partial<Record<CmsLogoSlot, boolean>>

/**
 * The logos `CmsBrandLogo` shows once some of them did not load. Each slot fails on its own:
 * - a light version that fails gives way as before: the full logo to the mark, the mark to the
 *   initials, in both modes (its dark version alone would leave light mode without a logo);
 * - a dark version that fails leaves the light one standing, on the cream tile in dark mode,
 *   as if no dark version had been given.
 */
export function cmsShownLogo(logo: CmsAdminTheme['logo'], failed: CmsLogoFailures): CmsAdminTheme['logo'] {
  const full = failed.full ? null : logo.full
  const mark = failed.mark ? null : logo.mark
  const fullPlate = !!full && (logo.fullDarkPlate || !!failed.fullDark)
  const markPlate = !!mark && (logo.markDarkPlate || !!failed.markDark)
  return {
    full,
    mark,
    fullDark: full ? (fullPlate ? full : logo.fullDark) : null,
    markDark: mark ? (markPlate ? mark : logo.markDark) : null,
    fullDarkPlate: fullPlate,
    markDarkPlate: markPlate,
  }
}

/** What `cmsFailedLogos` needs of an `<img>` (an interface, so it can be checked without a browser). */
export interface CmsLogoImage {
  readonly complete: boolean
  readonly dataset: { logo?: string }
  getAttribute(name: string): string | null
  decode(): Promise<void>
}

/**
 * An image that failed before the page came alive (server-rendered, then hydrated) sent its
 * error event to nobody. This asks each image that had already finished whether it can be
 * decoded: a 404 or a file that is not a picture rejects, a logo that loaded resolves.
 * Natural size is no test: an SVG with only a viewBox (no width or height, as design tools
 * export it) has no size of its own, and a browser may report a natural width of 0 for it
 * (the spec allows it; older Firefox did) although it loaded.
 * Images still loading are left alone; their own error event arrives after hydration.
 */
export async function cmsFailedLogos(images: Iterable<CmsLogoImage>): Promise<CmsLogoSlot[]> {
  const checks = Array.from(images)
    .filter((img) => img.complete && img.getAttribute('src') && img.dataset.logo)
    .map((img) => img.decode().then(() => null, () => img.dataset.logo as CmsLogoSlot))
  return (await Promise.all(checks)).filter((slot): slot is CmsLogoSlot => !!slot)
}
