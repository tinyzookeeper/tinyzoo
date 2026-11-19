// Where the docs are. The npm package carries no docs, so every message the CLI or the
// server prints that points at one gives the address on GitHub (a relative `docs/…` path
// leads nowhere from a site's terminal). test/unit/docs-urls.spec.ts keeps each anchor
// pointing at a heading that exists.

export const DOCS_URL = 'https://github.com/tinyzookeeper/tinyzoo/blob/main/docs'

/** The docs pages and headings messages point at, by what they are about. */
export const DOC_LINKS = {
  upgrading: { file: 'upgrading.md' },
  twoStepRule: { file: 'upgrading.md', anchor: 'the-two-step-rule' },
  renamingField: { file: 'upgrading.md', anchor: 'renaming-a-field' },
  renamingEntity: { file: 'upgrading.md', anchor: 'renaming-an-entity' },
  requiredField: { file: 'upgrading.md', anchor: 'adding-a-required-field' },
  changingType: { file: 'upgrading.md', anchor: 'changing-a-fields-type' },
  from07to10: { file: 'upgrading.md', anchor: 'from-07-to-10' },
  neverApplied: { file: 'upgrading.md', anchor: 'migration--was-never-applied-but-a-newer-one-was' },
  databaseUrlRemoved: { file: 'upgrading.md', anchor: 'cmsdatabaseurl-is-gone' },
  backups: { file: 'deploying.md', anchor: 'backups-and-restore' },
  media: { file: 'deploying.md', anchor: 'media' },
} as const

export type DocLink = keyof typeof DOC_LINKS

/** The GitHub address of a docs page or heading. */
export function docsUrl(link: DocLink): string {
  const { file, anchor } = DOC_LINKS[link] as { file: string; anchor?: string }
  return `${DOCS_URL}/${file}${anchor ? `#${anchor}` : ''}`
}
