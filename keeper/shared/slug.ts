/**
 * A workspace's or team's part of the address (/w/<slug>/t/<slug>): lower case, ASCII letters
 * and digits joined by dashes, at most 48 characters. Made once from the name and never again,
 * so links keep working after a rename. Migration 0008 makes the same slugs in SQL.
 */
export function slugify(name: string, fallback = 'workspace'): string {
  const s = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 's')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
  return s || fallback
}

/** Team slugs that would clash with the address: /t/all is "every team". */
export const RESERVED_TEAM_SLUGS = new Set(['all'])
