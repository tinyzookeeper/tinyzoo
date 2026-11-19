/**
 * A library folder name as the server stores it: one level (a "/" or "\" becomes a space),
 * no control characters, single spaces, trimmed, at most 80 characters; empty = no folder.
 * The upload and the media PATCH store a folder this way; `tinyzoo seed` refuses a folder
 * this would change, since a second run looks the file up by the folder the seed gives.
 */
export function cleanMediaFolder(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.replace(/[\u0000-\u001f\u007f/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  return v || null
}
