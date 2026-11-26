// The heading the look's own Text part draws for a kit's section (KitSection, KitEntries), found in the
// part's element by a stable rule: the first heading element of the frame that is not inside the
// section's own content. Every look draws it as an h1 or h2 before the content (useFrameHeading).

/** The frame's heading in `root`, outside the section's content `body`; null when the look draws none (an empty heading). */
export function frameHeading(root: Element, body: Element | null): Element | null {
  for (const h of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (body?.contains(h)) continue
    return h
  }
  return null
}
