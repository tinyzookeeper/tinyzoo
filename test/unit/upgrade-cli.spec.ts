import { mkdirSync, mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MigrationStatus } from 'tinyzoo'
import { isRisky, removeMigrations, scanBreaking } from '../../packages/cms/cli/breaking'
import { generateMigration, NEEDS_TERMINAL_MESSAGE, type GenerateOptions } from '../../packages/cms/cli/generate'
import { formatStatus } from '../../packages/cms/cli/status'
import { checkVersions, satisfiesRange } from '../../packages/cms/cli/versions'

const BP = '--> statement-breakpoint\n'

describe('breaking-statement scanner', () => {
  const messages = (sql: string) => scanBreaking(sql).map((c) => c.message)

  it('says nothing about additive migrations', () => {
    expect(scanBreaking(`CREATE TABLE "post" ("id" uuid);${BP}ALTER TABLE "post" ADD COLUMN "lead" text;${BP}CREATE INDEX "i" ON "post" ("lead");${BP}ALTER TABLE "post" ADD CONSTRAINT "fk" FOREIGN KEY ("a") REFERENCES "b"("id");`)).toEqual([])
  })

  it('names a dropped column and its table', () => {
    expect(messages('ALTER TABLE "post" DROP COLUMN "lead";')).toEqual(['drops column `lead` of `post` — its content is lost'])
    expect(messages('ALTER TABLE IF EXISTS "public"."post" DROP COLUMN IF EXISTS "lead" CASCADE;')).toEqual(['drops column `lead` of `post` — its content is lost'])
  })

  it('finds several drops in one hand-written statement', () => {
    expect(messages('ALTER TABLE "post" DROP COLUMN "a", DROP COLUMN "b";').length).toBe(2)
  })

  it('names a dropped table and a dropped type', () => {
    expect(messages('DROP TABLE "post_locales" CASCADE;')).toEqual(['drops table `post_locales` — every row in it is lost'])
    expect(messages('DROP TABLE IF EXISTS "public"."old";')[0]).toContain('`old`')
    expect(messages('DROP TYPE "public"."post_status";')[0]).toContain('drops type `post_status`')
  })

  it('names a type change, with or without SET DATA', () => {
    expect(messages('ALTER TABLE "post" ALTER COLUMN "n" SET DATA TYPE integer;')[0]).toBe('changes the type of column `n` of `post` to integer — values that do not convert are lost, or the migration fails')
    expect(messages('ALTER TABLE "post" ALTER COLUMN "n" TYPE numeric(10, 2) USING "n"::numeric;')[0]).toContain('to numeric(10, 2)')
  })

  it('names renames of tables, columns and types', () => {
    expect(messages('ALTER TABLE "post" RENAME TO "article";')).toEqual(['renames table `post` to `article` — the running version still reads the old name'])
    expect(messages('ALTER TABLE "post" RENAME COLUMN "title" TO "headline";')).toEqual(['renames column `title` of `post` to `headline` — the running version still reads the old name'])
    expect(messages('ALTER TYPE "post_status" RENAME TO "article_status";')[0]).toContain('renames type')
  })

  it('does not stop on renaming an index or constraint, which no running version can notice', () => {
    expect(scanBreaking('ALTER TABLE "post" RENAME CONSTRAINT "a" TO "b";')).toEqual([])
    expect(scanBreaking('ALTER INDEX "a" RENAME TO "b";')).toEqual([])
  })

  it('is not fooled by comments or string literals', () => {
    expect(scanBreaking(`-- DROP TABLE "x";\nALTER TABLE "post" ADD COLUMN "note" text DEFAULT 'DROP TABLE "y"';`)).toEqual([])
    expect(scanBreaking('/* ALTER TABLE "a" DROP COLUMN "b" */ SELECT 1;')).toEqual([])
  })

  it('reports every offender of a migration, with its statement', () => {
    const found = scanBreaking(`ALTER TABLE "a" DROP COLUMN "x";${BP}ALTER TABLE "b" ADD COLUMN "y" text;${BP}DROP TABLE "c";`)
    expect(found.map((c) => c.kind)).toEqual(['drop-column', 'drop-table'])
    expect(found[1]!.statement).toBe('DROP TABLE "c";')
  })
})

describe('risky-statement scanner (may fail on existing rows)', () => {
  const kinds = (sql: string) => scanBreaking(sql).map((c) => c.kind)
  const messages = (sql: string) => scanBreaking(sql).map((c) => c.message)

  // The SQL below is what drizzle-kit 0.31.10 writes for these schema changes.
  it('names a required column without a default', () => {
    expect(messages('ALTER TABLE "post" ADD COLUMN "slug" text NOT NULL;')).toEqual(['adds required column `slug` to `post` without a default — fails if `post` has rows; give the field a default, or add it optional first, fill it, then make it required'])
    expect(kinds('ALTER TABLE "post" ADD COLUMN "extra" jsonb NOT NULL;')).toEqual(['required-column'])
    expect(kinds('ALTER TABLE "post" ADD COLUMN "price" numeric(10, 2) NOT NULL;')).toEqual(['required-column'])
    expect(kinds('ALTER TABLE "public"."post" ADD COLUMN IF NOT EXISTS "slug" text NOT NULL;')).toEqual(['required-column'])
  })

  it('lets a required column with a default through (existing rows get it)', () => {
    expect(scanBreaking(`ALTER TABLE "post" ADD COLUMN "lead" text DEFAULT '' NOT NULL;${BP}ALTER TABLE "post" ADD COLUMN "gallery" jsonb DEFAULT '[]'::jsonb NOT NULL;${BP}ALTER TABLE "post" ADD COLUMN "n" integer GENERATED ALWAYS AS IDENTITY NOT NULL;`)).toEqual([])
  })

  it('lets an optional column through, and a string that only looks like NOT NULL', () => {
    expect(scanBreaking(`ALTER TABLE "post" ADD COLUMN "code" text;${BP}ALTER TABLE "post" ADD COLUMN "note" text DEFAULT 'x NOT NULL';`)).toEqual([])
  })

  it('finds the required column among several actions of one statement', () => {
    expect(kinds('ALTER TABLE "post" ADD COLUMN "a" text, ADD COLUMN "b" text NOT NULL, ADD COLUMN "c" numeric(10, 2) DEFAULT 0 NOT NULL;')).toEqual(['required-column'])
    expect(messages('ALTER TABLE "post" ADD COLUMN "a" text, ADD COLUMN "b" text NOT NULL;')[0]).toContain('`b`')
  })

  it('names SET NOT NULL', () => {
    expect(messages('ALTER TABLE "post" ALTER COLUMN "title" SET NOT NULL;')).toEqual(['makes column `title` of `post` required — fails if any row has no value there; fill the empty ones first (in an earlier release), then make it required'])
  })

  it('does not stop on DROP NOT NULL or a changed default', () => {
    expect(scanBreaking(`ALTER TABLE "feedback" ALTER COLUMN "role" DROP NOT NULL;${BP}ALTER TABLE "post" ALTER COLUMN "lead" SET DEFAULT 'x';`)).toEqual([])
  })

  it('names a new unique constraint, single and composite', () => {
    expect(messages('ALTER TABLE "post" ADD CONSTRAINT "post_code_unique" UNIQUE("code");')).toEqual(['adds a unique constraint `post_code_unique` on `code` of `post` — fails if rows there already share a value; check the existing rows (or clean them up) first'])
    expect(messages('ALTER TABLE "post" ADD CONSTRAINT "post_n_other_unique" UNIQUE("n","other");')[0]).toContain('on `n`, `other` of `post`')
    expect(kinds('ALTER TABLE "post" ADD UNIQUE ("code");')).toEqual(['unique'])
  })

  it('names a new unique index', () => {
    expect(messages('CREATE UNIQUE INDEX "post_title_idx" ON "post" USING btree ("title");')).toEqual(['adds a unique index `post_title_idx` on `title` of `post` — fails if rows there already share a value; check the existing rows (or clean them up) first'])
    expect(kinds('CREATE UNIQUE INDEX "i" ON "post_locales" USING btree ("locale","slug");')).toEqual(['unique'])
  })

  it('lets a plain index and a new foreign key through', () => {
    expect(scanBreaking(`CREATE INDEX "i" ON "post" USING btree ("lead");${BP}ALTER TABLE "post" ADD CONSTRAINT "fk" FOREIGN KEY ("a") REFERENCES "public"."b"("id") ON DELETE cascade;`)).toEqual([])
  })

  it('names a new check constraint', () => {
    expect(kinds('ALTER TABLE "post" ADD CONSTRAINT "post_n_check" CHECK ("n" > 0);')).toEqual(['check'])
  })

  it('ignores everything on a table the same migration creates (it is empty)', () => {
    expect(scanBreaking(`CREATE TABLE "tag" (\n\t"id" uuid PRIMARY KEY NOT NULL,\n\t"slug" text NOT NULL,\n\tCONSTRAINT "tag_slug_unique" UNIQUE("slug")\n);${BP}ALTER TABLE "tag" ADD COLUMN "x" text NOT NULL;${BP}CREATE UNIQUE INDEX "tag_i" ON "tag" USING btree ("slug");`)).toEqual([])
  })

  it('only skips the tables this migration creates, not others', () => {
    expect(kinds(`CREATE TABLE "tag" ("id" uuid);${BP}ALTER TABLE "post" ADD COLUMN "x" text NOT NULL;`)).toEqual(['required-column'])
  })

  it('lists only the renames of the snake_case upgrade (what drizzle-kit 0.31.10 wrote for the site host at ac81ccf)', () => {
    const sql = [
      'ALTER TABLE "formSettings" RENAME TO "form_settings";',
      'ALTER TABLE "siteSettings" RENAME TO "site_settings";',
      'ALTER TABLE "siteSettings_locales" RENAME TO "site_settings_locales";',
      'ALTER TABLE "site_settings" DROP CONSTRAINT "siteSettings_og_image_id_cms_media_id_fk";\n',
      'ALTER TABLE "site_settings_locales" DROP CONSTRAINT "siteSettings_locales_parent_id_siteSettings_id_fk";\n',
      'DROP INDEX "siteSettings_locales_parent_locale_unique";',
      'ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_og_image_id_cms_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."cms_media"("id") ON DELETE set null ON UPDATE no action;',
      'ALTER TABLE "site_settings_locales" ADD CONSTRAINT "site_settings_locales_parent_id_site_settings_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;',
      'CREATE UNIQUE INDEX "site_settings_locales_parent_locale_unique" ON "site_settings_locales" USING btree ("parent_id","locale");',
    ].join(BP)
    expect(kinds(sql)).toEqual(['rename', 'rename', 'rename'])
  })

  it('still flags a new unique index on a renamed table that was not there before', () => {
    expect(kinds(`ALTER TABLE "siteSettings" RENAME TO "site_settings";${BP}CREATE UNIQUE INDEX "site_settings_code_unique" ON "site_settings" USING btree ("code");`)).toEqual(['rename', 'unique'])
  })

  it('tells destructive and risky statements apart', () => {
    const found = scanBreaking(`ALTER TABLE "post" DROP COLUMN "a";${BP}ALTER TABLE "post" ADD COLUMN "b" text NOT NULL;`)
    expect(found.map((c) => [c.kind, isRisky(c)])).toEqual([['drop-column', false], ['required-column', true]])
  })
})

describe('generate guard', () => {
  let dir: string
  const journal = (tags: string[]) => JSON.stringify({ version: '7', dialect: 'postgresql', entries: tags.map((tag, idx) => ({ idx, version: '7', when: 1000 + idx, tag, breakpoints: true })) }, null, 2)
  const write = (tag: string, sql: string) => {
    writeFileSync(join(dir, `${tag}.sql`), sql)
    writeFileSync(join(dir, 'meta', `${tag.slice(0, 4)}_snapshot.json`), '{}')
  }
  /** What drizzle-kit does: write the next migration, its snapshot and a journal entry (no trailing newline). */
  const drizzleKitWrites = (sql: string) => async () => {
    write('0001_next', sql)
    writeFileSync(join(dir, 'meta/_journal.json'), journal(['0000_init', '0001_next']))
    return { ok: true, needsTerminal: false }
  }
  const run = (over: Partial<GenerateOptions>) => {
    const out: string[] = []
    return generateMigration({
      migrationsDir: dir, allowDrop: false, interactive: false, confirm: async () => false,
      runDrizzleKit: drizzleKitWrites('SELECT 1;'), log: (l) => out.push(l), error: (l) => out.push(l), ...over,
    }).then((code) => ({ code, out: out.join('\n') }))
  }
  const journalBefore = () => journal(['0000_init']) + '\n'

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tz-gen-'))
    mkdirSync(join(dir, 'meta'))
    write('0000_init', 'CREATE TABLE "post" ("lead" text);')
    writeFileSync(join(dir, 'meta/_journal.json'), journalBefore())
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('keeps a harmless migration', async () => {
    const { code } = await run({ runDrizzleKit: drizzleKitWrites('ALTER TABLE "post" ADD COLUMN "x" text;') })
    expect(code).toBe(0)
    expect(existsSync(join(dir, '0001_next.sql'))).toBe(true)
  })

  it('without a terminal removes a migration that drops data — file, snapshot and journal entry — and fails', async () => {
    const { code, out } = await run({ runDrizzleKit: drizzleKitWrites('ALTER TABLE "post" DROP COLUMN "lead";') })
    expect(code).toBe(1)
    expect(out).toContain('drops column `lead` of `post` — its content is lost')
    expect(out).toContain('docs/upgrading.md')
    expect(out).toContain('two-step rule')
    expect(existsSync(join(dir, '0001_next.sql'))).toBe(false)
    expect(existsSync(join(dir, 'meta/0001_snapshot.json'))).toBe(false)
    expect(readFileSync(join(dir, 'meta/_journal.json'), 'utf8')).toBe(journalBefore()) // byte for byte
    expect(existsSync(join(dir, '0000_init.sql'))).toBe(true)
  })

  it('asks on a terminal: yes keeps the migration, no (the default) removes it', async () => {
    const asked: string[] = []
    const sql = 'DROP TABLE "post";'
    const yes = await run({ interactive: true, runDrizzleKit: drizzleKitWrites(sql), confirm: async (q) => { asked.push(q); return true } })
    expect(yes.code).toBe(0)
    expect(asked.length).toBe(1)
    expect(existsSync(join(dir, '0001_next.sql'))).toBe(true)
    removeMigrations(dir, ['0001_next'], journalBefore())
    const no = await run({ interactive: true, runDrizzleKit: drizzleKitWrites(sql), confirm: async () => false })
    expect(no.code).toBe(1)
    expect(existsSync(join(dir, '0001_next.sql'))).toBe(false)
  })

  it('--allow-drop keeps it without asking', async () => {
    const { code, out } = await run({ allowDrop: true, runDrizzleKit: drizzleKitWrites('ALTER TABLE "post" DROP COLUMN "lead";'), confirm: async () => { throw new Error('asked') } })
    expect(code).toBe(0)
    expect(out).toContain('--allow-drop')
    expect(existsSync(join(dir, '0001_next.sql'))).toBe(true)
  })

  describe('risky statements (may fail on existing rows)', () => {
    const required = 'ALTER TABLE "post" ADD COLUMN "slug" text NOT NULL;'
    const gone = () => !existsSync(join(dir, '0001_next.sql')) && !existsSync(join(dir, 'meta/0001_snapshot.json'))

    it('without a terminal removes the migration and says what to do', async () => {
      const { code, out } = await run({ runDrizzleKit: drizzleKitWrites(required) })
      expect(code).toBe(1)
      expect(out).toContain('adds required column `slug` to `post` without a default — fails if `post` has rows')
      expect(out).toContain('restarted in a loop')
      expect(out).toContain('"Adding a required field"')
      expect(out).toContain('--allow-risky')
      expect(out).not.toContain('--allow-drop')
      expect(out).not.toContain('two-step rule') // nothing here loses data
      expect(gone()).toBe(true)
      expect(readFileSync(join(dir, 'meta/_journal.json'), 'utf8')).toBe(journalBefore())
    })

    it('--allow-drop does not allow them', async () => {
      const { code } = await run({ allowDrop: true, runDrizzleKit: drizzleKitWrites(required) })
      expect(code).toBe(1)
      expect(gone()).toBe(true)
    })

    it('--allow-risky keeps them without asking, but not a drop in the same migration', async () => {
      const kept = await run({ allowRisky: true, runDrizzleKit: drizzleKitWrites(required), confirm: async () => { throw new Error('asked') } })
      expect(kept.code).toBe(0)
      expect(kept.out).toContain('--allow-risky: keeping the migration')
      expect(existsSync(join(dir, '0001_next.sql'))).toBe(true)
      removeMigrations(dir, ['0001_next'], journalBefore())

      const mixed = await run({ allowRisky: true, runDrizzleKit: drizzleKitWrites(`${required}--> statement-breakpoint\nALTER TABLE "post" DROP COLUMN "lead";`) })
      expect(mixed.code).toBe(1)
      expect(mixed.out).toContain('--allow-drop')
      expect(gone()).toBe(true)
    })

    it('both flags keep a migration with both kinds', async () => {
      const { code, out } = await run({ allowDrop: true, allowRisky: true, runDrizzleKit: drizzleKitWrites(`${required}--> statement-breakpoint\nALTER TABLE "post" DROP COLUMN "lead";`) })
      expect(code).toBe(0)
      expect(out).toContain('--allow-drop and --allow-risky: keeping the migration')
    })

    it('asks on a terminal', async () => {
      const yes = await run({ interactive: true, runDrizzleKit: drizzleKitWrites(required), confirm: async () => true })
      expect(yes.code).toBe(0)
      removeMigrations(dir, ['0001_next'], journalBefore())
      const no = await run({ interactive: true, runDrizzleKit: drizzleKitWrites(required), confirm: async () => false })
      expect(no.code).toBe(1)
      expect(gone()).toBe(true)
    })
  })

  it('fails with the rename recipe when drizzle-kit needs a terminal for its rename question', async () => {
    const { code, out } = await run({ runDrizzleKit: async () => ({ ok: false, needsTerminal: true }) })
    expect(code).toBe(1)
    expect(out).toBe(NEEDS_TERMINAL_MESSAGE)
    expect(out).toContain('Renaming a field')
  })

  it('fails when drizzle-kit fails, and keeps quiet when there is nothing to migrate', async () => {
    expect((await run({ runDrizzleKit: async () => ({ ok: false, needsTerminal: false }) })).code).toBe(1)
    expect((await run({ runDrizzleKit: async () => ({ ok: true, needsTerminal: false }) })).code).toBe(0)
  })

  it('puts CREATE EXTENSION pg_trgm in front of a migration with a trigram index', async () => {
    await run({ runDrizzleKit: drizzleKitWrites('CREATE INDEX "i" ON "post" USING gin ("lead" gin_trgm_ops);') })
    expect(readFileSync(join(dir, '0001_next.sql'), 'utf8')).toMatch(/^CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint\n/)
  })
})

describe('version checks', () => {
  it('understands the range forms tinyzoo uses', () => {
    expect(satisfiesRange('4.2.1', '^4.0.0')).toBe(true)
    expect(satisfiesRange('5.0.0', '^4.0.0')).toBe(false)
    expect(satisfiesRange('3.9.9', '^4.0.0')).toBe(false)
    expect(satisfiesRange('0.44.7', '^0.44.0')).toBe(true)
    expect(satisfiesRange('0.45.0', '^0.44.0')).toBe(false)
    expect(satisfiesRange('0.5.29', '^0.5.0')).toBe(true)
    expect(satisfiesRange('1.2.9', '~1.2.3')).toBe(true)
    expect(satisfiesRange('1.3.0', '~1.2.3')).toBe(false)
    expect(satisfiesRange('22.1.0', '>=22')).toBe(true)
    expect(satisfiesRange('20.0.0', '>=22')).toBe(false)
    expect(satisfiesRange('3.1.0', '^2.0.0 || ^3.0.0')).toBe(true)
    expect(satisfiesRange('4.0.0-rc.1', '^4.0.0')).toBe(true)
  })

  it('reports installed packages outside tinyzoo\'s ranges and missing ones', () => {
    const root = mkdtempSync(join(tmpdir(), 'tz-ver-'))
    try {
      const install = (name: string, version: string) => {
        mkdirSync(join(root, 'node_modules', name), { recursive: true })
        writeFileSync(join(root, 'node_modules', name, 'package.json'), JSON.stringify({ name, version }))
      }
      install('nuxt', '4.1.0'); install('@nuxt/ui', '3.3.0'); install('drizzle-orm', '0.44.7')
      const problems = checkVersions(root, { peerDependencies: { nuxt: '^4.0.0', '@nuxt/ui': '^4.0.0' }, dependencies: { 'drizzle-orm': '^0.44.0', zod: '^4.0.0' } })
      expect(problems).toEqual([
        { name: '@nuxt/ui', installed: '3.3.0', wanted: '^4.0.0' },
        { name: 'zod', installed: null, wanted: '^4.0.0' },
      ])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })
})

describe('status report', () => {
  const base: MigrationStatus = { freshInstall: false, applied: ['0000_a'], pending: [], outOfOrder: [], unknown: 0, steps: [{ id: 'fill', since: '0.2.0', description: 'fills things', phase: 'after', state: 'applied' }] }

  it('is clean when nothing is pending', () => {
    const { text, clean } = formatStatus(base)
    expect(clean).toBe(true)
    expect(text).toContain('1 applied, 0 pending')
    expect(text).toContain('✓ up to date')
  })

  it('lists pending migrations and steps and is not clean', () => {
    const { text, clean } = formatStatus({ ...base, pending: ['0001_b'], steps: [{ ...base.steps[0]!, state: 'pending' }] })
    expect(clean).toBe(false)
    expect(text).toContain('pending  0001_b')
    expect(text).toContain('pending  fill (tinyzoo 0.2.0) — fills things')
  })

  it('shows an out-of-order migration with the fix', () => {
    const { text, clean } = formatStatus({ ...base, outOfOrder: ['0003_late'] })
    expect(clean).toBe(false)
    expect(text).toContain('0003_late.sql')
    expect(text).toContain('tinyzoo generate')
    expect(text).toContain('already ran on another database')
    expect(text).toContain('can run twice')
  })

  it('does not count a conditional step that is not needed right now', () => {
    expect(formatStatus({ ...base, steps: [{ ...base.steps[0]!, state: 'idle' }] }).clean).toBe(true)
  })
})
