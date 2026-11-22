/**
 * The widths (px) the server makes smaller WebP copies of an uploaded picture at, served at
 * `/api/cms/_media/img/<media id>/<width>.webp`. `<CmsImage>` lists them in srcset, and
 * browsers and CDNs keep those addresses for a year (immutable), so a width is never taken
 * away within a major: the list may only grow (test/unit/api-surface.spec.ts guards it).
 * Only these widths exist, so nobody can make the server produce thousands of sizes.
 *
 * Close steps where phones are (a 412 px wide phone at 1.75× wants about 720 px, so 750 fits
 * it almost exactly; 828 is a 414 px phone at 2×), and 2560 for a full-width picture on a
 * high-density laptop screen. The browser takes the smallest one that is big enough, so a
 * picture is rarely more than a fifth larger than the place it is shown in.
 */
export const CMS_IMAGE_WIDTHS = [320, 480, 640, 750, 828, 960, 1080, 1280, 1440, 1920, 2560] as const
