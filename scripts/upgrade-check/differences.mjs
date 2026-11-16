// Differences between what a site returned on its old tinyzoo and what it returns after
// the upgrade that are EXPECTED, because a release changed them on purpose. Everything
// not listed here fails the upgrade check.
//
// Each rule: { path, kind?, why }
//   path  where, as the check prints it: object keys joined by dots, array positions as `[]`,
//         ids left out. `*` is one segment, `**` is anything:
//           content.page.cs.sections[].image.url      the content API, page entries, Czech
//           admin.page.default.slug                   the admin's view of a page
//           sitemap[].loc
//   kind  'added' | 'removed' | 'changed' (any when left out)
//   why   what changed and where it is announced: the changelog entry (or its changeset) that
//         tells sites about it. A rule without a reason is refused.
//
// A rule that only one baseline needs belongs in that baseline's hook file instead
// (scripts/upgrade-check/<ref>.mjs, `differences`).
//
// Example, for a release that adds a field to every page in the content API:
//   { path: 'content.page.*.breadcrumbs', kind: 'added', why: '0.3.0: the content API returns breadcrumbs (changelog, "Page tree")' },
export default [
  {
    path: 'admin.**.v',
    kind: 'added',
    why: '0.2.0 (versioned JSON content, and the review fix after it): the admin API stamps `v` on every block and list item it hands the editor, so a save can say which shape it was written against. Stored JSON and the content API are unchanged.',
  },
]
