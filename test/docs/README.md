# The docs check

Code in the developer guide (`docs/guide/*.md`) and in the README is checked so the examples cannot rot.
`pnpm docs:check` (also run by `pnpm typecheck`) does this:

1. `scripts/docs-check/extract.ts` finds every fenced block whose line above is a marker
   `<!-- check: <group>/<path> [flag] -->` and groups them into small sites.
2. The files are written to `test/docs/.generated/<group>/` (git-ignored). A `.vue` block
   is reduced to the body of its `<script setup lang="ts">`, saved as `<name>.vue.ts`:
   **templates are not checked**, only the script. `~/…` imports become relative paths.
3. Each group's `cms.config.ts` is **loaded for real**: `buildRegistry`, `emitSchema` and
   `emitContentTypes` run on it (this finds definition errors that types do not, such as
   `.localized()` on a number or a reserved entity name). The typed client it emits is
   written to the group's `app/lib/cms-content.ts`, which is what `~/lib/cms-content`
   imports resolve to.
4. `tsc -p test/docs/tsconfig.json` checks everything. An error is reported as
   `docs/guide/<file>.md:<line>` (the Markdown line of the offending code), the group and
   the file.

`nuxt-stubs.d.ts` declares what snippets use without importing it (Nuxt auto-imports, the
starter's `useSiteLocale`, `<script setup>` macros, a few Nitro helpers), reduced to the
signatures the snippets need. Add a stub only when a doc needs one, and keep it true to
the real signature.

Marker syntax and files, in one place:

| Marker | Meaning |
|---|---|
| `<!-- check: news/cms.config.ts -->` | a standalone config for the group `news` (imports included) |
| `<!-- check: news/cms.config.ts + -->` | continues the same file: the text is added below, no repeated imports |
| `<!-- check: news/cms.config.ts append-to-starter -->` | added to a copy of the starter's `cms.config.ts` (first block only) |
| `<!-- check: news/app/pages/x.vue -->` | the script of a page or component; `app/**/*.ts` and `server/**/*.ts` work too |

A group needs a `cms.config.ts`; the same file path may appear again in a group only with
the `+` flag. The unit tests for the extractor are in `test/unit/docs-check.spec.ts`.
