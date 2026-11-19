import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addComponentsDir, addServerHandler, addServerPlugin, addTypeTemplate, defineNuxtModule, extendPages } from '@nuxt/kit'
import { createJiti } from 'jiti'
import { docsUrl } from './src/docs'
import { collectPlugins, planPlugins, type CmsPlugin } from './src/plugin'

const layerDir = dirname(fileURLToPath(import.meta.url))

export interface CmsModuleOptions {
  /** Path to the host config, relative to rootDir. Default: 'cms.config.ts'. */
  config?: string
  /** Blob storage for uploaded media. Defaults to the local filesystem driver. */
  storage?: {
    /** 'local' (default) writes to disk; 's3'/'r2' use an S3-compatible store. */
    driver?: 'local' | 's3' | 'r2'
    local?: {
      /** Upload dir, resolved against the runtime cwd. Default '.cms-uploads'. */
      dir?: string
      /** URL base the local serving route is mounted at. */
      publicBase?: string
    }
    /**
     * S3-compatible object store (AWS S3 / Cloudflare R2 / MinIO). Secrets are
     * server-only; prefer NUXT_CMS_STORAGE_S3_* env vars over committing them.
     */
    s3?: {
      endpoint?: string
      region?: string
      bucket?: string
      accessKeyId?: string
      secretAccessKey?: string
      /** Public URL prefix for serving (CDN / r2.dev / custom domain). */
      publicBaseUrl?: string
      /**
       * How browsers get the files. `'public'`: straight from a public bucket or CDN
       * (the stored address is the bucket's). `'proxy'`: for a private bucket — the app
       * streams each file (`/api/cms/_media/raw/<key>`, with byte ranges). `'redirect'`:
       * private bucket, the app answers with a five-minute signed address; the stored
       * address is the same app path, so it never expires. Default: `'public'` when
       * `publicBaseUrl` is set, otherwise `'proxy'`. Env: NUXT_CMS_STORAGE_S3_DELIVERY.
       */
      delivery?: 'public' | 'proxy' | 'redirect'
    }
    /** Max upload size in MB (per file). Default 10. */
    maxSizeMb?: number
    /** Per-user total storage quota in bytes. 0 = unlimited (default). */
    maxBytesPerUser?: number
    /** Max uploads per user per minute. 0 = unlimited. Default 60. */
    uploadRatePerMin?: number
  }
  /**
   * Who owns sign-in. 'builtin' (default): the CMS has its own users, invites,
   * password resets and roles. 'external': the host signs people in and sets
   * `event.context.cmsUser` itself (e.g. SSO); the CMS's auth pages and team
   * management are switched off.
   */
  auth?: {
    mode?: 'builtin' | 'external'
    /**
     * Proxies in front of the app that append to X-Forwarded-For (default 1 — one
     * ingress/load balancer). The client IP for rate limits is read that many hops
     * from the end, so a client cannot choose it. 0 = use the socket address.
     */
    trustedProxies?: number
    /** Header holding the client IP when a trusted edge sets one, e.g. 'cf-connecting-ip'. */
    ipHeader?: string
  }
  /**
   * Absolute public URL of this app, e.g. 'https://cms.example.com'. Used for links
   * in emails (invites, password resets) — required in production. Env: NUXT_CMS_PUBLIC_URL.
   */
  publicUrl?: string
  /**
   * Outgoing email (invites, password resets).
   *  - 'log' (default): print to the server log
   *  - 'file': write each email as JSON into `file.dir` (local development, tests)
   *  - 'smtp': any SMTP server (Node runtime only)
   * Env: NUXT_CMS_MAIL_TRANSPORT, NUXT_CMS_MAIL_FROM, NUXT_CMS_MAIL_SMTP_HOST, …
   */
  mail?: {
    transport?: 'log' | 'file' | 'smtp'
    from?: string
    smtp?: { host?: string; port?: number; secure?: boolean; user?: string; pass?: string }
    file?: { dir?: string }
  }
  /**
   * Redis for state shared by all instances (rate limits, realtime). Defaults to the
   * REDIS_URL environment variable (Pushbase sets it for a linked Redis service).
   * Env: NUXT_CMS_REDIS_URL. Without it, state lives in each instance's memory.
   * `prefix` (NUXT_CMS_REDIS_PREFIX) namespaces keys and channels; default
   * `cms:<database name>`, so environments sharing one Redis stay apart.
   */
  redis?: { url?: string; prefix?: string }
  /**
   * How often scheduled entries are checked for going live (a cron expression; **build
   * time**: it is written into the build, so a change needs a rebuild and there is no
   * `NUXT_CMS_*` variable). Their content is live on time regardless — this only sends the
   * webhooks and live updates for that moment. Default every minute.
   */
  scheduler?: { cron?: string }
  /**
   * How long personal data is kept (GDPR). A daily scheduled task enforces it.
   *  - auditDays: delete audit-log entries older than this (default 365, 0 = keep forever).
   *    Env NUXT_CMS_RETENTION_AUDIT_DAYS.
   * Form submissions have their own: `defineForm(name, { retentionDays })`.
   * The task runs daily at `cron` (a cron expression; **build time**, like `scheduler.cron`:
   * a change needs a rebuild; default '17 3 * * *').
   */
  retention?: { auditDays?: number; cron?: string }
  /** Revisions (history, compare, restore): how many to keep per entry and language. 0 = off. */
  revisions?: { keep?: number }
  /**
   * Publish webhooks: every change visible on the website is POSTed, signed, to these
   * URLs (e.g. the site's cache-purge endpoint). See server/utils/cmsWebhooks.ts.
   * Env: NUXT_CMS_WEBHOOKS_URLS (comma separated), NUXT_CMS_WEBHOOKS_SECRET.
   */
  webhooks?: { urls?: string | string[]; secret?: string }
  /**
   * Addresses on the website that are not entries (the news list, the contact page) so
   * they belong in /sitemap.xml: full addresses (language prefix included), or one object
   * per page with its address in each language, which makes them hreflang alternates:
   *
   *   sitemap: { paths: ['/kontakt', { cs: '/aktuality', en: '/en/news' }] }
   *
   * For addresses that come from data, use the `cms:sitemap` Nitro hook instead (it can
   * push entries). Both end up in /sitemap.xml (@nuxtjs/sitemap, which also lists the
   * site's own static pages) and /api/content/_sitemap.
   */
  sitemap?: { paths?: (string | Record<string, string>)[] }
  /**
   * Website forms (defineForm):
   *  - notifyTo: fallback recipients of new submissions: an address, or a list of them
   *    (env NUXT_CMS_FORMS_NOTIFY_TO, comma separated)
   *  - turnstileSecret: Cloudflare Turnstile secret; when set, every submission must
   *    pass it (env NUXT_CMS_FORMS_TURNSTILE_SECRET). The site key goes to
   *    `public.cmsTurnstileSiteKey` (env NUXT_PUBLIC_CMS_TURNSTILE_SITE_KEY).
   */
  forms?: { notifyTo?: string | string[]; turnstileSecret?: string; turnstileSiteKey?: string }
  /**
   * A public demo admin: the sign-in page shows these details, the account is created
   * (as an editor) the first time someone signs in with them, and it cannot change
   * its name or password or ask for a reset link. Both are public on purpose
   * (env NUXT_PUBLIC_CMS_DEMO_EMAIL, NUXT_PUBLIC_CMS_DEMO_PASSWORD). Leave empty on
   * real sites.
   */
  demo?: { email?: string; password?: string }
  /**
   * Database migrations bundled into the server build and applied when it starts —
   * for platforms that ship only the build output (Pushbase, containers).
   *  - dir: the drizzle-kit migrations folder, relative to rootDir (default server/db/migrations)
   *  - onStart: apply them at start (env NUXT_CMS_MIGRATIONS_ON_START=true). Default off.
   */
  migrations?: { dir?: string; onStart?: boolean }
  /**
   * The site summary at `GET /api/health/status` (CmsStatus), for a tool that watches many
   * sites: versions, health, how much the site is used. Off until `token` is set (env
   * NUXT_CMS_STATUS_TOKEN); the request then carries it as `x-api-key` or `Authorization: Bearer`.
   */
  status?: { token?: string }
  /** Public content-delivery API (`/api/content/*`). */
  content?: {
    /** If set, every content request must carry this token (x-api-key or Bearer). Default: open. */
    token?: string
    /** Cache-Control header for content responses when open. */
    cacheControl?: string
    /**
     * Absolute public origin of this CMS (e.g. 'https://cms.example.com'), used as the
     * OpenAPI `servers[].url`. Left blank, it falls back to `cms.publicUrl`; with neither
     * set, the spec uses a relative '/' server — never the request Host (which is
     * attacker-controlled and would poison the cached spec).
     */
    publicUrl?: string
    /**
     * The interactive API reference at `/api/openapi` (Scalar, loaded from a CDN, public
     * on the admin's origin). Default: on in development, off in production; set `true`
     * (env NUXT_CMS_CONTENT_DOCS=true) to publish it. `/api/openapi.json` is not affected.
     */
    docs?: boolean
  }
}

/**
 * The plugins of the host's `cms.config.ts` (`export const plugins = [...]`, plus the
 * ones an entity registers by itself, see `collectPlugins`). The config is read at build
 * time with jiti, exactly as the CLI reads it, because the admin pages, server routes
 * and components a plugin brings have to be registered before the build starts.
 */
async function loadPlugins(configPath: string, alias: Record<string, string>): Promise<CmsPlugin[]> {
  if (!existsSync(configPath)) return []
  try {
    const jiti = createJiti(configPath, { alias, interopDefault: true, moduleCache: false, fsCache: false })
    return collectPlugins(await jiti.import<Record<string, any>>(configPath))
  }
  catch (err: any) {
    throw new Error(`[tinyzoo] could not read the plugins from ${configPath}: ${err?.message ?? err}`, { cause: err })
  }
}

/** `cms.sitemap.paths` checked at build time: each is an address starting with one "/" (or a map of them per language). */
function sitemapPaths(paths: (string | Record<string, string>)[] | undefined): (string | Record<string, string>)[] {
  const ok = (p: unknown) => typeof p === 'string' && /^\/(?!\/)[^\s?#]*$/.test(p)
  for (const p of paths ?? []) {
    const all = typeof p === 'string' ? [p] : Object.values(p ?? {})
    if (!all.length || !all.every(ok)) throw new Error(`[tinyzoo] sitemap.paths: ${JSON.stringify(p)} must be an address starting with "/" (no query or fragment), or an object of them per language.`)
  }
  return paths ?? []
}

/**
 * What 0.6 deprecated and 1.0 removed, refused at build time with what to do instead: a site
 * that still sets one would otherwise build without its database address or on another schedule.
 */
function refuseRemoved(options: CmsModuleOptions): void {
  const problems: string[] = []
  if ((options as { databaseUrl?: unknown }).databaseUrl !== undefined) {
    problems.push('`cms.databaseUrl` was removed in 1.0: delete it from nuxt.config.ts and set DATABASE_URL (or NUXT_CMS_DATABASE_URL) in the environment.')
  }
  for (const [name, option] of [['CMS_SCHEDULER_CRON', 'scheduler'], ['CMS_RETENTION_CRON', 'retention']] as const) {
    if (process.env[name]) problems.push(`The variable ${name} was removed in 1.0: set \`cms: { ${option}: { cron: '${process.env[name]}' } }\` in nuxt.config.ts and remove the variable.`)
  }
  if (problems.length) throw new Error(`[tinyzoo] ${problems.join('\n[tinyzoo] ')}\nSee "From 0.7 to 1.0": ${docsUrl('from07to10')}`)
}

export default defineNuxtModule<CmsModuleOptions>({
  meta: { name: 'tinyzoo', configKey: 'cms' },
  defaults: { config: 'cms.config.ts' },
  // /sitemap.xml is @nuxtjs/sitemap's (Nuxt SEO), resolved from tinyzoo's own folder so a
  // site does not install it. tinyzoo hands it the entries and the site's address
  // (server/plugins/cms-sitemap.ts). A site changes it with `sitemap: { … }` in
  // nuxt.config; these are only the defaults.
  moduleDependencies: {
    '@nuxtjs/sitemap': {
      version: '>=9.1.0',
      defaults: {
        // The admin is not part of the website.
        exclude: ['/admin', '/admin/**'],
        // Kept on the server and in browsers for an hour; a content change clears the
        // server's copy at once (invalidateSitemap), so a new page is listed straight away.
        cacheMaxAgeSeconds: 60 * 60,
      },
    },
  },
  async setup(options, nuxt) {
    const configPath = resolve(nuxt.options.rootDir, options.config || 'cms.config.ts')
    refuseRemoved(options)
    if (!existsSync(configPath)) {
      console.warn(`[tinyzoo] No cms.config.ts found at ${configPath}. Create one with defineEntity().`)
    }

    // Expose the host config as a virtual alias to app and Nitro server.
    nuxt.options.alias['#cms/config'] = configPath
    // Bundle the host's migrations as server assets so they ship with .output.
    const migrationsDir = resolve(nuxt.options.rootDir, options.migrations?.dir || 'server/db/migrations')
    nuxt.hook('nitro:config', (nitro) => {
      if (existsSync(migrationsDir)) {
        nitro.serverAssets = nitro.serverAssets || []
        nitro.serverAssets.push({ baseName: 'cms-migrations', dir: migrationsDir })
      }
      // Scheduled publishing: announce entries whose publish time has come.
      nitro.experimental = { ...(nitro.experimental || {}), tasks: true }
      const cron = options.scheduler?.cron || '* * * * *'
      nitro.scheduledTasks = { ...(nitro.scheduledTasks || {}), [cron]: [...((nitro.scheduledTasks as any)?.[cron] ?? []), 'cms:scheduled'] }
      // Retention (GDPR): delete form submissions and audit entries past their time, daily.
      const retentionCron = options.retention?.cron || '17 3 * * *'
      nitro.scheduledTasks = { ...nitro.scheduledTasks, [retentionCron]: [...((nitro.scheduledTasks as any)?.[retentionCron] ?? []), 'cms:retention'] }
      nitro.alias = nitro.alias || {}
      nitro.alias['#cms/config'] = configPath
      nitro.externals = nitro.externals || {}
      nitro.externals.inline = nitro.externals.inline || []
    })

    // The session shape the built-in sign-in stores (nuxt-auth-utils' User/UserSession),
    // so hosts get `useUserSession().user.value.role` typed without declaring it.
    addTypeTemplate({
      filename: 'types/cms-auth.d.ts',
      getContents: () => `declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    role: 'admin' | 'editor' | 'author' | (string & {})
    locale: string | null
  }
  interface UserSession {
    cms?: { uid: string; sv: number; iat: number }
  }
}
declare module 'nitropack/types' {
  interface NitroRuntimeHooks {
    /** A content change was saved (see CmsChange). Runs on the instance that saved it. */
    'cms:change': (change: import('tinyzoo').CmsChange) => void | Promise<void>
    /** The sitemap is being built: push entries for addresses that are not entries (see CmsSitemapEntry). Runs at most once a minute. */
    'cms:sitemap': (entries: import('tinyzoo').CmsSitemapEntry[]) => void | Promise<void>
    /** A server error (5xx request, failed scheduled task, webhook that gave up), after the response. See CmsErrorReport. */
    'cms:error': (report: import('tinyzoo').CmsErrorReport) => void | Promise<void>
  }
}
export {}
`,
    }, { nitro: true, nuxt: true })

    // Plugins (defineCmsPlugin): their admin pages, server routes, Nitro plugins, components,
    // field renderers and admin texts, registered here; their entities, hooks and upgrade
    // steps reach the server through the registry (src/entity.ts, buildRegistry).
    const plugins = await loadPlugins(configPath, nuxt.options.alias as Record<string, string>)
    const plan = planPlugins(plugins, { exists: existsSync })
    if (plan.pages.length) {
      extendPages((pages) => {
        for (const page of plan.pages) pages.push({ name: page.name, path: page.path, file: page.file })
      })
    }
    for (const h of plan.handlers) addServerHandler({ method: h.method, route: h.route, handler: h.handler })
    for (const file of plan.serverPlugins) addServerPlugin(file)
    for (const path of plan.componentDirs) addComponentsDir({ path, pathPrefix: false, global: true })
    // What the admin needs to know about plugins: the sidebar entries, the field renderers and
    // the texts (public runtime config: nothing secret in it).
    nuxt.options.runtimeConfig.public.cmsPlugins = {
      plugins: plan.plugins,
      navItems: plan.navItems,
      fields: plan.fields,
      messages: plan.messages,
    } as any
    // Runtime config consumed by the server.
    nuxt.options.runtimeConfig.cms = {
      // Always empty in the build: the address comes from NUXT_CMS_DATABASE_URL or DATABASE_URL
      // at runtime (useCms() reads them). Never read DATABASE_URL here: this runs at BUILD time
      // and would bake the build machine's database into the output.
      databaseUrl: '',
      migrations: { onStart: options.migrations?.onStart ?? false },
      redis: { url: options.redis?.url || '', prefix: options.redis?.prefix || '' },
      // Revisions kept per entry and language (0 = off). Env NUXT_CMS_REVISIONS_KEEP.
      revisions: { keep: options.revisions?.keep ?? 50 },
      // Audit entries older than this are deleted daily (0 = keep). Env NUXT_CMS_RETENTION_AUDIT_DAYS.
      retention: { auditDays: options.retention?.auditDays ?? 365 },
      // Empty defaults so NUXT_CMS_WEBHOOKS_URLS / NUXT_CMS_WEBHOOKS_SECRET bind at runtime.
      webhooks: {
        urls: (Array.isArray(options.webhooks?.urls) ? options.webhooks.urls.join(',') : options.webhooks?.urls) || '',
        secret: options.webhooks?.secret || '',
      },
      sitemap: { paths: sitemapPaths(options.sitemap?.paths) },
      auth: {
        mode: options.auth?.mode || 'builtin',
        trustedProxies: options.auth?.trustedProxies ?? 1,
        ipHeader: options.auth?.ipHeader || '',
        // Empty default so NUXT_CMS_AUTH_SETUP_TOKEN binds at runtime ('' = no token needed).
        setupToken: '',
      },
      // Empty defaults so NUXT_CMS_PUBLIC_URL / NUXT_CMS_MAIL_* bind at runtime.
      publicUrl: options.publicUrl || '',
      mail: {
        transport: options.mail?.transport || 'log',
        from: options.mail?.from || '',
        smtp: {
          host: options.mail?.smtp?.host || '',
          port: options.mail?.smtp?.port ?? 587,
          secure: options.mail?.smtp?.secure ?? false,
          user: options.mail?.smtp?.user || '',
          pass: options.mail?.smtp?.pass || '',
        },
        file: { dir: options.mail?.file?.dir || '.cms-mail' },
      },
      storage: {
        driver: options.storage?.driver || 'local',
        local: {
          dir: options.storage?.local?.dir || '.cms-uploads',
          publicBase: options.storage?.local?.publicBase || '/api/cms/_media/raw',
        },
        // Empty-string defaults so NUXT_CMS_STORAGE_S3_* env vars bind at runtime.
        s3: {
          endpoint: options.storage?.s3?.endpoint || '',
          region: options.storage?.s3?.region || '',
          bucket: options.storage?.s3?.bucket || '',
          accessKeyId: options.storage?.s3?.accessKeyId || '',
          secretAccessKey: options.storage?.s3?.secretAccessKey || '',
          publicBaseUrl: options.storage?.s3?.publicBaseUrl || '',
          // '' = the default (public with a publicBaseUrl, otherwise proxy), resolved where it is used.
          delivery: options.storage?.s3?.delivery || '',
        },
        maxSizeMb: options.storage?.maxSizeMb ?? 10,
        maxBytesPerUser: options.storage?.maxBytesPerUser ?? 0,
        uploadRatePerMin: options.storage?.uploadRatePerMin ?? 60,
      },
      // Empty defaults so NUXT_CMS_FORMS_* bind at runtime.
      forms: {
        notifyTo: (Array.isArray(options.forms?.notifyTo) ? options.forms.notifyTo.join(',') : options.forms?.notifyTo) || '',
        turnstileSecret: options.forms?.turnstileSecret || '',
      },
      // Empty so NUXT_CMS_STATUS_TOKEN binds at runtime; '' = /api/health/status is off.
      status: { token: options.status?.token || '' },
      content: {
        // Empty so NUXT_CMS_CONTENT_TOKEN can bind at runtime; '' = open API.
        token: options.content?.token || '',
        cacheControl: options.content?.cacheControl || '',
        publicUrl: options.content?.publicUrl || '',
        // '' = the default (on in development, off in production); NUXT_CMS_CONTENT_DOCS binds at runtime (as a string, like every env value).
        docs: options.content?.docs === undefined ? '' : String(options.content.docs),
      },
      ...(nuxt.options.runtimeConfig.cms as Record<string, unknown> | undefined),
    }
    // The Turnstile site key is public (it goes into the website's form).
    nuxt.options.runtimeConfig.public.cmsTurnstileSiteKey ||= options.forms?.turnstileSiteKey || ''
    // The demo admin's sign-in details are public (they are printed on the sign-in page).
    nuxt.options.runtimeConfig.public.cmsDemo ||= { email: options.demo?.email || '', password: options.demo?.password || '' }
    // Development only: the site's public/ folder, where the logo check at start looks for
    // cms.admin.logo files (server/plugins/cms-logo-check.ts). A build never carries it.
    if (nuxt.options.dev) (nuxt.options.runtimeConfig.cms as Record<string, unknown>).devPublicDir = resolve(nuxt.options.rootDir, nuxt.options.dir?.public || 'public')
  },
})
