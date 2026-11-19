/**
 * Upgrade steps: the data work of an upgrade that a schema migration cannot express.
 *
 * `tinyzoo generate` only writes the schema half of a change (`ALTER TABLE …`). When a
 * change also needs data — a backfill, an extension, rows that must exist — the package
 * ships a step for it, and every site picks it up the same way: at start
 * (`NUXT_CMS_MIGRATIONS_ON_START`) or with `tinyzoo up`, inside the same transaction
 * and advisory lock as the site's own migrations. See docs/upgrading.md ("For tinyzoo
 * maintainers") for when to write one.
 *
 * Bookkeeping lives in `cms_upgrades`, created by the runner itself with
 * `CREATE TABLE IF NOT EXISTS`. It is package-owned bookkeeping, like drizzle's
 * `__drizzle_migrations`, and is deliberately NOT emitted into the host's schema.ts:
 * it has to exist before the first host migration runs (a `before` step may be what
 * makes that migration possible), a host migration would only be able to create it
 * after the fact, and a host that drops or renames it would silently re-run every
 * step. (Do not use `drizzle-kit push` on a site: it would propose dropping it.)
 */
import type { SqlRunner } from './migrate'
import { pluginUpgradeSteps } from './plugin'

export interface UpgradeContext {
  /** Runs SQL inside the migration transaction (and under its advisory lock). */
  run: SqlRunner
  /**
   * Every statement of the host migrations this run applies (empty when there is
   * nothing to apply) — what `when` looks at to tell whether a step matters now.
   */
  pendingStatements: string[]
  /** No host migration had been applied before this run: an empty database. */
  freshInstall: boolean
}

export interface UpgradeStep {
  /** Stable and unique, kebab-case (`<plugin>:<id>` for a plugin's step). Never change it once released: it is what gets recorded. */
  id: string
  /** The version that introduced the step: tinyzoo's, or the plugin's own for a plugin's step. */
  since: string
  /** One line, plain language: what the step does and why. */
  description: string
  /** `before`: ahead of the site's pending migrations. `after`: once they have been applied. */
  phase: 'before' | 'after'
  /**
   * On an empty database a step is recorded as applied without running (a backfill
   * has nothing to fill). Set `'run'` for a step the migrations themselves depend on,
   * such as enabling an extension.
   */
  freshInstall?: 'skip' | 'run'
  /**
   * Whether the step matters in this run. A step without `when` runs once and is
   * then recorded. A step with `when` runs every time `when` is true — so it must be
   * idempotent — because a later migration may need it again.
   */
  when?: (ctx: UpgradeContext) => boolean | Promise<boolean>
  /** Must be idempotent: running it twice leaves the same result as once. */
  run: (ctx: UpgradeContext) => void | Promise<void>
}

export interface StepOutcome {
  id: string
  /** false: recorded as applied without running (fresh install). */
  ran: boolean
}

/** Package-owned bookkeeping table; see the header comment. */
export const UPGRADES_TABLE_SQL = 'CREATE TABLE IF NOT EXISTS "cms_upgrades" ("id" text PRIMARY KEY, "since" text, "applied_at" timestamptz DEFAULT now())'

// tinyzoo's own steps are `kebab-case`; a plugin's are `<plugin>:<kebab-case>` (see plugin.ts).
const STEP_ID = /^([a-z][a-z0-9]*(-[a-z0-9]+)*:)?[a-z0-9][a-z0-9-]*$/

/** Throws on a malformed or duplicated step; plugins hand in their own lists. */
export function assertValidSteps(steps: UpgradeStep[]): void {
  const seen = new Set<string>()
  for (const s of steps) {
    if (!STEP_ID.test(s.id)) throw new Error(`Upgrade step id "${s.id}" must be kebab-case (letters, digits, dashes)`)
    if (seen.has(s.id)) throw new Error(`Two upgrade steps share the id "${s.id}"`)
    seen.add(s.id)
    if (s.phase !== 'before' && s.phase !== 'after') throw new Error(`Upgrade step "${s.id}" needs phase 'before' or 'after'`)
  }
}

/** Is the step relevant now, given what has been recorded? (Used by the runner and by `status`.) */
export async function stepIsDue(step: UpgradeStep, ctx: UpgradeContext, done: ReadonlySet<string>): Promise<boolean> {
  if (step.when) return Boolean(await step.when(ctx))
  return !done.has(step.id)
}

/**
 * Run the steps of one phase in list order. Steps already recorded are skipped (unless
 * they have a `when`, which decides every time); on a fresh install they are recorded
 * without running unless they set `freshInstall: 'run'`.
 */
export async function runUpgradeSteps(
  phase: UpgradeStep['phase'],
  steps: UpgradeStep[],
  ctx: UpgradeContext,
  done: Set<string>,
): Promise<StepOutcome[]> {
  const outcomes: StepOutcome[] = []
  for (const step of steps) {
    if (step.phase !== phase) continue
    if (!(await stepIsDue(step, ctx, done))) continue
    const ran = !ctx.freshInstall || step.freshInstall === 'run'
    if (ran) await step.run(ctx)
    if (!done.has(step.id)) {
      await ctx.run('insert into "cms_upgrades" ("id", "since") values ($1, $2) on conflict ("id") do nothing', [step.id, step.since])
      done.add(step.id)
    }
    outcomes.push({ id: step.id, ran })
  }
  return outcomes
}

/**
 * The steps tinyzoo itself ships. Plugins contribute theirs next to these (namespaced
 * `<plugin>:<id>`, see `pluginUpgradeSteps`; `allUpgradeSteps` is the whole list); the
 * runner takes it as a parameter.
 *
 * @internal
 */
export const CORE_UPGRADE_STEPS: UpgradeStep[] = [
  {
    id: 'enable-pg-trgm',
    since: '0.2.0',
    description: 'Enable the pg_trgm extension that the search index needs',
    phase: 'before',
    // The first migration of a new site may already create a trigram index.
    freshInstall: 'run',
    // Trigram indexes (the search index) need pg_trgm: a trusted extension the database
    // owner may enable, shipped with standard Postgres images (CloudNativePG included).
    when: ({ pendingStatements }) => pendingStatements.some((s) => s.includes('gin_trgm_ops')),
    run: async ({ run }) => { await run('CREATE EXTENSION IF NOT EXISTS pg_trgm') },
  },
  {
    id: 'media-in-library',
    since: '1.0.0',
    description: 'Keep the files uploaded before the media library came in 0.2 in the library',
    phase: 'after',
    // Only a site from before 0.2 gains the column: its migration adds it as `false` for
    // every file, and a file that is not in the library is deleted once nothing uses it.
    // 0.2's own playground migration set every existing file to `true`; sites got neither
    // that line nor this step until 1.0. On the run that adds the column every file is an
    // old one, so marking all of them is exact.
    when: ({ pendingStatements }) => pendingStatements.some((s) => /ALTER TABLE\s+(?:"[^"]+"\.)?"cms_media"\s+ADD COLUMN\s+"in_library"/i.test(s)),
    run: async ({ run }) => { await run('UPDATE "cms_media" SET "in_library" = true WHERE "in_library" = false') },
  },
]

/**
 * tinyzoo's steps and those of the plugins, in that order (plugins in registration order).
 *
 * @internal
 */
export function allUpgradeSteps(plugins: readonly import('./plugin').CmsPlugin[] = []): UpgradeStep[] {
  return [...CORE_UPGRADE_STEPS, ...pluginUpgradeSteps(plugins)]
}
