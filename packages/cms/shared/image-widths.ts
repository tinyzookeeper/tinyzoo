/**
 * The widths (px) the server makes smaller WebP copies of an uploaded picture at, served at
 * `/api/cms/_media/img/<media id>/<width>.webp`. `<CmsImage>` lists them in srcset, and
 * browsers and CDNs keep those addresses for a year (immutable), so a width is never taken
 * away within a major: the list may only grow (test/unit/api-surface.spec.ts guards it).
 * Only these widths exist, so nobody can make the server produce thousands of sizes.
 */
export const CMS_IMAGE_WIDTHS = [320, 640, 960, 1280, 1920] as const
