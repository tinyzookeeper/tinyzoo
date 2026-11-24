import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { assertSlug } from '../../shared/slug'
import { HostingError, type HostedSite, type HostingDriver, type OnStep, type Provisioned, type SiteSpec } from './types'

// The Pushbase driver: every website is a Pushbase project of its own, <slug>.pushbase.app.
//
// NOT EXERCISED. It is written against the published CLI (`npx -y pushbase@0.3.0 … --json`,
// see the pushbase-deploy skill) and the shapes its read-only commands return, but no command
// that creates or changes anything has ever been run from here. Read it as a careful draft.
//
// What it does, through the CLI only (never the REST API):
//   1. projects create <slug> --name "<slug>"            (found and kept when it exists)
//   2. services link <shared postgres> --key DATABASE_URL (each link gets a database and login of its own)
//   3. services create media --type storage; services link media --key NUXT_CMS_STORAGE_S3
//   4. env set --stdin                                    (the site's environment, never on the command line)
//   5. deploy --dir <template folder> --preset nuxt       (packs the folder, builds, rolls out)
//   6. wait until https://<slug>.pushbase.app/api/health/ready answers
//
// What is known to be missing:
//   - The CLI (0.3.0) has no command to delete a project or a service, so `remove` cannot
//     finish: it says so instead of pretending.
//   - The template folder must be a standalone project (its own package.json and lockfile, as
//     `pnpm create tinyzoo` makes one): the starter inside this repository depends on the
//     workspace and cannot be uploaded as it is. NUXT_HOSTING_PUSHBASE_TEMPLATES_DIR holds one
//     folder per template, named by the template's id.
//   - Every site is built on the platform again (minutes, not seconds). One image for all
//     sites would need the platform to deploy an existing image.
//   - PUSHBASE_TOKEN must reach `project:create`, `service:create`, `service:link`.

const CLI = ['-y', 'pushbase@0.3.0']

interface PushbaseConfig { templatesDir: string; database: string; team: string }

function config(): PushbaseConfig {
  const c = ((useRuntimeConfig().hosting as any)?.pushbase ?? {}) as Record<string, unknown>
  return { templatesDir: String(c.templatesDir || ''), database: String(c.database || ''), team: String(c.team || '') }
}

interface CliResult<T> { ok: boolean; data: T | null; error: string | null }

/** Run one CLI command with --json. Arguments are passed as a list (never through a shell); secrets go through stdin. */
function pushbase<T = any>(args: string[], opts: { stdin?: string; timeoutMs?: number } = {}): Promise<CliResult<T>> {
  return new Promise((done) => {
    const child = execFile('npx', [...CLI, ...args, '--json'], { timeout: opts.timeoutMs ?? 120_000, maxBuffer: 8 * 1024 * 1024, env: process.env }, (err, stdout, stderr) => {
      let json: any = null
      try { json = stdout ? JSON.parse(stdout) : null } catch { /* not JSON */ }
      if (err || json?.error) {
        const why = typeof json?.error === 'string' ? json.error : json?.error?.message ?? String(stderr || err?.message || 'failed').slice(-600)
        done({ ok: false, data: json, error: why })
        return
      }
      done({ ok: true, data: json as T, error: null })
    })
    if (opts.stdin !== undefined) child.stdin?.end(opts.stdin)
  })
}

async function must<T>(what: string, code: string, args: string[], opts?: { stdin?: string; timeoutMs?: number }): Promise<T> {
  const res = await pushbase<T>(args, opts)
  if (!res.ok) throw new HostingError(code, `${what}: ${res.error}`)
  return res.data as T
}

const target = (slug: string) => ['--project', slug, '--env', 'production']
const urlOf = (slug: string) => `https://${slug}.pushbase.app`

/** A dotenv document for `env set --stdin`: one KEY="value" per line, quotes and newlines escaped. */
function dotenv(env: Record<string, string>): string {
  return Object.entries(env)
    .filter(([key]) => /^[A-Z][A-Z0-9_]*$/.test(key))
    .map(([key, value]) => `${key}="${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`)
    .join('\n') + '\n'
}

async function ready(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health/ready`, { signal: AbortSignal.timeout(8000), redirect: 'manual' })
    return res.status === 200
  }
  catch {
    return false
  }
}

function templateDir(spec: SiteSpec): string {
  const base = config().templatesDir
  if (!base) throw new HostingError('template_not_built', 'set NUXT_HOSTING_PUSHBASE_TEMPLATES_DIR to a folder with one standalone project per template')
  const dir = join(resolve(base), spec.template.id)
  if (!existsSync(join(dir, 'package.json'))) throw new HostingError('template_not_built', `${dir} is not a project (no package.json)`)
  return dir
}

interface ServiceRow { name: string; type: string; status: string; shared: boolean; links?: { environment: string; envVarKey: string }[] }

export function pushbaseDriver(): HostingDriver {
  return {
    name: 'pushbase',

    async provision(spec: SiteSpec, onStep: OnStep): Promise<Provisioned> {
      const slug = assertSlug(spec.slug)
      const dir = templateDir(spec)
      const c = config()
      const publicUrl = urlOf(slug)

      await onStep('database', 'running')
      // The project: made once, found again on a resume.
      const existing = await pushbase(['projects', 'show', slug])
      if (!existing.ok) {
        await must('creating the project', 'database_failed', ['projects', 'create', slug, '--name', slug, ...(c.team ? ['--team', c.team] : [])])
      }
      // The database: the workspace's shared Postgres, a database and login of its own per link.
      const services = await must<ServiceRow[]>('listing services', 'database_failed', ['services', ...target(slug)])
      const linked = (s: ServiceRow) => (s.links ?? []).some((l) => l.environment === 'production')
      const db = services.find((s) => s.type === 'postgres' && s.shared && (!c.database || s.name === c.database))
      if (!db) throw new HostingError('database_failed', c.database ? `no shared Postgres named "${c.database}" in the workspace` : 'the workspace has no shared Postgres to link (set NUXT_HOSTING_PUSHBASE_DATABASE)')
      if (!linked(db)) await must('linking the database', 'database_failed', ['services', 'link', db.name, ...target(slug), '--key', 'DATABASE_URL'])
      // Storage: a bucket of its own (containers have a read-only disk).
      let media = services.find((s) => s.type === 'storage' && !s.shared && s.name === 'media')
      if (!media) {
        await must('creating storage', 'database_failed', ['services', 'create', 'media', '--type', 'storage', ...target(slug)])
        media = { name: 'media', type: 'storage', status: 'running', shared: false, links: [] }
      }
      if (!linked(media)) await must('linking storage', 'database_failed', ['services', 'link', 'media', ...target(slug), '--key', 'NUXT_CMS_STORAGE_S3'])
      await onStep('database', 'done')

      await onStep('start', 'running')
      await must('setting the environment', 'start_failed', ['env', 'set', '--stdin', ...target(slug)], {
        stdin: dotenv({
          ...spec.env,
          NUXT_CMS_PUBLIC_URL: publicUrl,
          NUXT_CMS_STORAGE_DRIVER: 's3',
          // Pushbase storage is private: tinyzoo serves the files itself (docs/deploying.md).
          NUXT_CMS_STORAGE_S3_DELIVERY: 'proxy',
        }),
      })
      if (!(await ready(publicUrl))) {
        await must('deploying', 'start_failed', ['deploy', '--dir', dir, '--preset', 'nuxt', ...target(slug)], { timeoutMs: 20 * 60_000 })
      }
      const until = Date.now() + 5 * 60_000
      while (!(await ready(publicUrl))) {
        if (Date.now() > until) throw new HostingError('start_timeout', `${publicUrl} did not answer within 5 minutes of the deploy`)
        await new Promise((r) => setTimeout(r, 3000))
      }
      await onStep('start', 'done')
      return { publicUrl, internalUrl: publicUrl, state: { project: slug, database: db.name, storage: 'media' } }
    },

    async ensureRunning(site: HostedSite): Promise<void> {
      // The platform keeps the pods running; a site that does not answer gets one restart.
      const url = site.publicUrl ?? urlOf(assertSlug(site.slug))
      if (await ready(url)) return
      await must('restarting', 'start_failed', ['restart', ...target(assertSlug(site.slug))])
    },

    async remove(site: HostedSite): Promise<void> {
      throw new HostingError('remove_unsupported', `the Pushbase CLI (0.3.0) cannot delete a project: remove "${assertSlug(site.slug)}" in the console`)
    },

    async describe(site: HostedSite) {
      return { running: await ready(site.publicUrl ?? urlOf(assertSlug(site.slug))) }
    },
  }
}
