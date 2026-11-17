import { DOCS_URL } from '../src/docs'

/**
 * What `tinyzoo` prints for `tinyzoo help`, `--help` and an unknown command, and the one
 * list of commands and flags the 1.0 freeze covers (docs/api-surface.md, "CLI"): a command or
 * flag listed here is not removed or renamed before 2.0, and is deprecated for a minor first.
 * test/unit/api-surface.spec.ts keeps the printed text in test/contracts/cli-usage.txt.
 */
export interface CliCommand {
  name: string
  /** Positional arguments, as written in the usage line. */
  args?: string
  summary: string
  /** Flags the command accepts: `[flag, what it does]`. */
  flags?: [string, string][]
}

export const CLI_COMMANDS: CliCommand[] = [
  { name: 'init', args: '<dir>', summary: 'a new website with the CMS inside (the starter: pages, news, menus, a contact form, cs/en)' },
  {
    name: 'generate',
    summary: 'emit server/db/schema.ts from cms.config.ts and write the migration (drizzle-kit)',
    flags: [
      ['--allow-drop', 'keep a migration that drops data (a removed or renamed field)'],
      ['--allow-risky', 'keep a migration that may fail on existing rows'],
    ],
  },
  { name: 'up', summary: 'apply the migrations and upgrade steps to DATABASE_URL (what the app does at start with NUXT_CMS_MIGRATIONS_ON_START)' },
  { name: 'status', summary: 'what DATABASE_URL has applied and has pending (exit 1 when something is pending, 2 when it cannot be read)' },
  {
    name: 'upgrade',
    summary: 'after updating tinyzoo: check versions, generate, regenerate the client, show the status',
    flags: [
      ['--allow-drop', 'as for generate'],
      ['--allow-risky', 'as for generate'],
    ],
  },
  { name: 'client', args: '[out]', summary: 'emit the typed @tinyzoo/client bindings (default cms-content.ts)', flags: [['--stdout', 'print instead of writing a file']] },
  { name: 'openapi', args: '[out]', summary: 'emit the OpenAPI 3.1 document of the content API (default openapi.json)', flags: [['--stdout', 'print instead of writing a file']] },
  {
    name: 'content:migrate',
    summary: 'rewrite stored blocks, lists and rich text to their current versions',
    flags: [
      ['--dry-run', 'report only'],
      ['--batch <n>', 'rows per batch'],
    ],
  },
  {
    name: 'links:convert',
    summary: 'turn stored page addresses into links that follow their page',
    flags: [
      ['--dry-run', 'report only'],
      ['--batch <n>', 'rows per batch'],
    ],
  },
  {
    name: 'export',
    args: '<file.tar.gz>',
    summary: "the site's content (entries, translations, links, globals, media files) in one archive",
    flags: [
      ['--only a,b', 'only these entities (and the media they use)'],
      ['--no-media', 'media rows without the files'],
      ['--with-revisions', 'saved versions too'],
      ['--with-submissions', 'form submissions too (personal data)'],
      ['--force', 'overwrite an existing file'],
    ],
  },
  {
    name: 'import',
    args: '<file.tar.gz>',
    summary: 'put such an archive into this site (the target must be empty of content)',
    flags: [
      ['--replace', "delete this site's content first (asks)"],
      ['--merge', 'add and update entries by id, delete nothing'],
      ['--allow-mismatch', "the content models differ: skip what doesn't fit"],
      ['--dry-run', 'check and report, write nothing'],
      ['--yes', 'do not ask'],
      ['--no-search-index', 'do not rebuild the search index afterwards'],
    ],
  },
  { name: 'backup', args: '[file]', summary: 'the database (pg_dump) and the media files in one tar archive' },
  {
    name: 'restore',
    args: '<file>',
    summary: 'put such an archive back (into a clean database, all or nothing)',
    flags: [
      ['--yes', 'do not ask'],
      ['--force', 'replace a database that has tables'],
    ],
  },
  {
    name: 'seed',
    args: '[file]',
    summary: "put the site's seed content (seed/index.ts, defineSeed) into a running site through the admin API; the password is $SEED_PASSWORD",
    flags: [
      ['--url <url>', 'where the site runs (default $SEED_URL, else http://localhost:3000)'],
      ['--email <email>', 'the administrator to sign in as ($SEED_EMAIL)'],
      ['--name <name>', "the first administrator's name when the site has none yet ($SEED_NAME)"],
      ['--setup-code <code>', 'the code a new production site asks for first ($SEED_SETUP_CODE)'],
      ['--wait <sec>', 'how long to wait for the site to answer (default 30)'],
      ['--dry-run', 'say what would be created, changed or uploaded'],
      ['--reset', 'first remove what this seed made'],
      ['--yes', 'do not ask before --reset'],
      ['--verbose', 'also list what was already up to date'],
    ],
  },
]

/** The help text. */
export function usage(): string {
  const lines = ['usage: tinyzoo <command> [options]', '', 'Run from the root of the website. Commands:', '']
  const pad = Math.max(...CLI_COMMANDS.map((c) => `${c.name}${c.args ? ` ${c.args}` : ''}`.length))
  for (const c of CLI_COMMANDS) {
    lines.push(`  ${`${c.name}${c.args ? ` ${c.args}` : ''}`.padEnd(pad)}  ${c.summary}`)
    const flagPad = Math.max(0, ...(c.flags ?? []).map(([flag]) => flag.length))
    for (const [flag, what] of c.flags ?? []) lines.push(`  ${''.padEnd(pad)}    ${flag.padEnd(flagPad)}  ${what}`)
  }
  lines.push('', '  help, --help, -h   this text', '', `More: ${DOCS_URL}/README.md`)
  return `${lines.join('\n')}\n`
}
