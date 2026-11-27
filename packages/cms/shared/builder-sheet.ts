// The editor in the preview on a phone-sized admin (since 3e): the pure rules of the sheet that holds the
// selected block's panel at the bottom of the preview (CmsBuilderSheet). Kept apart so they are tested.

/** Whether the sheet is open after the selection changed. `from`: the page selected it, or the person inside the sheet (or the keyboard). */
export function cmsSheetAfterSelect(from: 'page' | 'inside', depth: number, open: boolean): boolean {
  // Inside the sheet it stays as it is (a row, a breadcrumb part, *All sections*, a delete).
  if (from === 'inside') return open
  // From the page: a block inside a section opens it (and follows the next one); a section or nothing leaves its handle only.
  return depth > 1
}

/** What a drag on the handle ends as: down on an open sheet closes it, up on a closed one opens it; else it snaps back. */
export function cmsSheetDragEnd(open: boolean, dy: number, closeBy = 60, openBy = 40): 'open' | 'close' | 'back' {
  if (open) return dy > closeBy ? 'close' : 'back'
  return dy < -openBy ? 'open' : 'back'
}

/** How far a drag moves the sheet from where it rests: an open one only down, a closed one only up (a little). */
export function cmsSheetDragOffset(open: boolean, dy: number, up = 72): number {
  return open ? Math.max(0, dy) : Math.max(-up, Math.min(0, dy))
}

/**
 * How many screen pixels of the page's frame the open sheet covers (0 closed): the sheet rests on the
 * viewport's bottom edge, the frame ends at `frameBottom` (above the closed handle).
 */
export function cmsSheetCovers(open: boolean, sheetHeight: number, viewportHeight: number, frameBottom: number): number {
  if (!open) return 0
  return Math.max(0, Math.round(frameBottom - (viewportHeight - sheetHeight)))
}

/** The room the stage keeps free at its bottom so the closed handle covers nothing of the page. */
export function cmsSheetStagePad(handleHeight: number, viewportHeight: number, stageBottom: number): number {
  return Math.max(0, Math.ceil(handleHeight - (viewportHeight - stageBottom)))
}
