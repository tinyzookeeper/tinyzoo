# Development

For people who work on tinyzoo itself: how the repository is laid out, how to run the
playground, the tests, the checks CI runs, and the decisions that shaped the code. Building
a website with tinyzoo is [the guide](README.md); contributing
conventions (changesets, deprecations, releases) are in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Architecture

| Piece | What it does |
|---|---|
| `f.*` field factories | each returns a `FieldDescriptor` carrying a **column IR**, a Zod validator, a default, and a UI renderer name |
| `defineEntity(name, def)` | builds the live Drizzle `pgTable` (the type-inference anchor; SQL name `snake_case(name)`) + Zod create/update schemas |
| `buildRegistry(config)` | two-phase: resolves relation thunks, creates m2m junctions, builds the serializable UI graph |
| `emitSchema(config)` | serializes the **same IR** to `db/schema.ts` source → **one IR, two sinks, zero drift** |
| `tinyzoo` CLI | `generate` (emit schema + `drizzle-kit generate`, stops on migrations that lose data) / `up` (migrations + upgrade steps) / `status` / `upgrade` — see [upgrading.md](upgrading.md) |
| Nuxt module | aliases `#cms/config`, wires runtimeConfig; the layer ships `/admin` + `Cms*` + server API |
| generic CRUD | one handler set dispatching by entity; relations, m2m diff-writes, populated labels |

### The single source of truth (`playground/cms.config.ts`)

```ts
export const Post = defineEntity('post', {
  label: 'Posts', titleField: 'title',
  admin: { list: { columns: ['title', 'status', 'author', 'publishedAt'] } },
  fields: {
    title:  f.text({ required: true }),
    slug:   f.slug({ from: 'title', unique: true }),
    status: f.select({ options: ['draft', 'published'] as const, default: 'draft' }),
    hero:   f.media({ accept: 'image/*' }).optional(),
    author: f.relation({ to: () => Author, kind: 'many-to-one', required: true }),
    tags:   f.relation({ to: () => Tag, kind: 'many-to-many' }),
    body:   f.richtext(),
  },
})
```

Entities are **precisely typed with no annotations** — the data shapes are inferred:

```ts
import type { Row, Insert } from "tinyzoo"

type PostRow = Row<typeof Post>
//   { id: string; title: string; status: 'draft' | 'published';
//     publishedAt: Date | null; heroId: string | null; authorId: string;
//     body: RichTextDoc; createdAt: Date; updatedAt: Date }

type NewPost = Insert<typeof Post>
//   author + title + slug + body required; status/tags/publishedAt/hero optional
```

## Repository layout

```
packages/cms/          tinyzoo — the Layer + Module
  src/                 field engine, defineEntity, registry, emitters (schema / openapi / sdk), the plugin API (plugin.ts)
  forms/               the forms plugin (`tinyzoo/forms`): defineForm, endpoints, <CmsForm>, retention
  cli/                 tinyzoo generate|up|status|upgrade|client|openapi|content:migrate (wraps drizzle-kit + codegen)
  module.ts            build-time wiring (#cms/config alias, runtimeConfig)
  nuxt.config.ts       layer root
  server/              generic CRUD + content API + drizzle DataSource (useCms)
  app/                 /admin pages + CmsField renderer
packages/client/       @tinyzoo/client — tiny strictly-typed content-API client (publishable)
playground/            demo host app: `extends: ['../packages/cms']`
  cms.config.ts        Post + Author + Tag (the source of truth), plugins: forms and events
  cms-plugins/events/  the example plugin (collection, admin page, routes, upgrade step)
  app/lib/             generated cms-content.ts (typed client bindings)
  server/db/           generated schema.ts + migrations
compose.yaml           local dev deps: Postgres, + MinIO behind the `s3` profile
```

## Run the playground

```bash
pnpm install

# 1. start Postgres (any Postgres works; compose.yaml is the local demo DB on :5434)
docker compose up -d

# 2. emit schema.ts from cms.config.ts and generate the SQL migration
pnpm db:generate

# 3. apply the migration
pnpm db:migrate

# 4. run the playground → http://localhost:3000/admin
pnpm play
```

On a fresh database, `/admin` asks you to create the first administrator; invite
everyone else from **Settings → Team**.

`docker compose down` stops it; the data lives in a named volume and survives (use
`down -v` to wipe it). If `:5434` is taken, `CMS_PG_PORT=5455 docker compose up -d` —
then match `DATABASE_URL` in `playground/.env`.

`DATABASE_URL` is read from `playground/.env`. Edit `playground/cms.config.ts`, re-run
`pnpm db:generate` (review the SQL!) and `pnpm db:migrate`, and the dashboard updates itself.
`pnpm db:generate` stops before a migration that drops data (a removed or renamed field);
moving a site to a newer tinyzoo is described in [upgrading.md](upgrading.md).

## Tests, typecheck & CI

```bash
pnpm test          # unit + API suites (needs the compose Postgres running)
pnpm test:unit     # core, CLI and server helpers: descriptors, codegen drift, sanitiser, client; the CLI specs use scratch databases (cms_test_*), ~15 s
pnpm test:api      # the built playground over real HTTP against real Postgres
pnpm typecheck     # core/client/tests (tsc), the docs' examples, and the playground, starter and website with the layer, templates included (vue-tsc 3)
pnpm build         # a plain production build (Pushbase, Docker, any VM); the API tests make one too
pnpm check         # typecheck + test: what CI runs on every pull request
```

`pnpm typecheck` reads the admin's Vue templates too: the playground's and the website's `nuxt typecheck`
run vue-tsc over everything their `.nuxt/tsconfig.*.json` include, which is their own `app/` and the
layer's (`packages/cms/app/**`, the components of `tinyzoo/forms` among them). A wrong prop, a value that
may be `undefined`, or a handler of the wrong type fails it with the file and line. It needs vue-tsc 3:
vue-tsc 2 found no `vue` package next to the generated tsconfig (pnpm does not hoist it there), skipped its
template types without a word, and so checked only the `<script>` blocks. The starter's own check
(`node scripts/typecheck.mjs`) reports only the starter's files, as a site made from it would.

One habit it asks for: an inline `@click` on a `UButton` that assigns or returns a value is written as
`@click="() => { open = false }"`. Nuxt UI 4.9 types the handler as returning `void | Promise<void>`, so
`@click="open = false"` (which returns `false`) does not type-check; Nuxt UI 4.10 lifts that.

The API suites run against **their own database**, `<dev db>_test` (e.g. `cms_test`; any name with a `test` word in it, such as `cms_test_ops`, is accepted),
which the global setup creates, wipes and migrates from the playground's migrations
on every run — never the development database. Set `TEST_DATABASE_URL` to point
elsewhere. The setup then production-builds the playground into
`node_modules/.cache/cms-test` (your own `.nuxt`/`.output` and dev server are left
alone), starts it on a free port with a throwaway upload directory, and the specs
talk to it over HTTP. The setup creates one account per role the way a real install
does (first-run setup for the admin, invitations for the editor and author) and
shares their sessions with the specs; emails land in a temp folder the specs read. Files run one at a time and truncate the
tables they use. While iterating on specs, `CMS_TEST_REUSE_BUILD=1 pnpm test:api`
skips the ~25 s rebuild (only when the server code did not change);
`CMS_TEST_SERVER_LOGS=1` prints the server's output at the end.

The test server waits less than a deployed one: the realtime and shared-editing heartbeats
(20 s and 30 s in production) and the webhook retry delays (1 s, then 5 s) are shortened
through `CMS_TEST_LIVE_HEARTBEAT_MS`, `CMS_TEST_COLLAB_HEARTBEAT_MS` and `CMS_TEST_WEBHOOK_RETRY_MS`
(`packages/cms/server/utils/cmsTiming.ts`; the values are in `test/setup/timers.ts`), which every
server the suites start gets, and the scheduler runs every second instead of every minute (a cron
fixed when the test build is made, `CMS_SCHEDULER_CRON`). Production reads none of these unless it is
told to; a spec waits for the condition (poll, don't sleep) rather than for as long as it takes.

Codegen drift is a test: the committed `playground/server/db/schema.ts` and
`playground/app/lib/cms-content.ts` must equal what the generators emit, and the
served `/api/content-types.ts` must equal the committed file.

**CI** (Node 22, the runtime Pushbase deploys on) is two workflows:

- `.github/workflows/ci.yml`, on every pull request and push to `main`: `check` (typecheck and the
  unit tests), `api` (the API tests against Postgres and Redis; their playground build is the build
  check, and is cached by the content of `packages/`, `playground/`, the lockfile and `test/setup/`)
  and, on pull requests, `changeset`. About four minutes, the two test jobs in parallel.
- `.github/workflows/heavy.yml`, the slow ones: `upgrade`, `consumer`, `backup` with `pg_dump` 16, 17
  and 18, and `s3-minio` (a real MinIO). Nightly on `main`, on demand (*Run workflow*), on the
  "Version packages" pull request, and on other pull requests only when they change what the job
  covers; `result` is the one check that says they all passed. The table of paths and how to run each
  one locally is in [CONTRIBUTING.md](../CONTRIBUTING.md#what-ci-runs-and-when).

The backup spec skips where `pg_dump` is missing (a laptop, the `api` job when the runner has none);
the `backup` jobs set `TINYZOO_REQUIRE_PG_TOOLS=1`, so there a missing tool is a failure.

**Releases.** `tinyzoo` and `@tinyzoo/client` share one version. Every change to a
package adds a changeset (`pnpm changeset`; a change a site must act on has an
`### Upgrade` section with the steps), and a changed contract snapshot
(`test/contracts/`, `pnpm contracts:update`) means the public content API changed.
Merging to `main` makes `.github/workflows/release.yml` open a "Version packages"
pull request; merging that publishes both packages to npm with provenance. Details,
the version policy and how deprecations work (`cmsDeprecated()`): [CONTRIBUTING.md](../CONTRIBUTING.md).

## Decisions that shaped the code

- **Stack:** Nuxt 4, Tailwind 4, Nuxt UI v4, Zod 4, Drizzle (Postgres dialect).
- **Runtime:** a Node server (Node 22+) — Pushbase, Docker or any VM. Cloudflare Workers
  support was dropped in Phase 5b; see docs/production-plan.md.
- `select` → native `pgEnum`; rich text → `jsonb` (TipTap doc); ids → `uuid`; media → `cms_media` FK.

## Not built yet

The plan, with the order and the reasons, is in [roadmap.md](roadmap.md). Open items from the early slices:

- Precise `table` *value*-typing in `eq()` (columns are typed `PgColumn` today — key autocomplete works, value side is loose)
