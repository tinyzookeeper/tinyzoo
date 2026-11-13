import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addTypeTemplate, defineNuxtModule } from '@nuxt/kit'

const layerDir = dirname(fileURLToPath(import.meta.url))

export interface CmsModuleOptions {
  /** Path to the host config, relative to rootDir. Default: 'cms.config.ts'. */
  config?: string
  /**
   * Postgres connection string. Leave it out in production: the server reads
   * NUXT_CMS_DATABASE_URL or DATABASE_URL at runtime, which win over this value.
   */
  databaseUrl?: string
  /**
   * Runtime DB driver, chosen at BUILD time so only its deps are bundled:
   *  - 'node' (default): node-postgres + `pg` (Node servers)
   *  - 'edge': Neon serverless over WebSocket (Cloudflare Workers et al.)
   * Env override: CMS_DB_DRIVER.
   */
  db?: { driver?: 'node' | 'edge' }
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
   * Publish webhooks: every change visible on the website is POSTed, signed, to these
   * URLs (e.g. the site's cache-purge endpoint). See server/utils/cmsWebhooks.ts.
   * Env: NUXT_CMS_WEBHOOKS_URLS (comma separated), NUXT_CMS_WEBHOOKS_SECRET.
   */
  webhooks?: { urls?: string | string[]; secret?: string }
  /**
   * Database migrations bundled into the server build and applied when it starts —
   * for platforms that ship only the build output (Pushbase, containers).
   *  - dir: the drizzle-kit migrations folder, relative to rootDir (default server/db/migrations)
   *  - onStart: apply them at start (env NUXT_CMS_MIGRATIONS_ON_START=true). Default off.
   */
  migrations?: { dir?: string; onStart?: boolean }
  /** Public content-delivery API (`/api/content/*`). */
  content?: {
    /** If set, every content request must carry this token (x-api-key or Bearer). Default: open. */
    token?: string
    /** Cache-Control header for content responses when open. */
    cacheControl?: string
    /**
     * Absolute public origin of this CMS (e.g. 'https://cms.example.com'), used as the
     * OpenAPI `servers[].url`. Left blank, the spec uses a relative '/' server — never
     * the request Host (which is attacker-controlled and would poison the cached spec).
     */
    publicUrl?: string
  }
}

export default defineNuxtModule<CmsModuleOptions>({
  meta: { name: '@my-cms/core', configKey: 'cms' },
  defaults: { config: 'cms.config.ts' },
  setup(options, nuxt) {
    const configPath = resolve(nuxt.options.rootDir, options.config || 'cms.config.ts')
    if (!existsSync(configPath)) {
      console.warn(`[@my-cms/core] No cms.config.ts found at ${configPath}. Create one with defineEntity().`)
    }

    // Pick the DB driver impl at build time so only its deps land in the bundle.
    const dbDriver = options.db?.driver || process.env.CMS_DB_DRIVER || 'node'
    const dbImpl = resolve(layerDir, 'server/db', dbDriver === 'edge' ? 'driver.edge.ts' : 'driver.node.ts')
    // Same switch for mail: only the Node build bundles SMTP (nodemailer).
    const mailImpl = resolve(layerDir, 'server/mail', dbDriver === 'edge' ? 'mailer.edge.ts' : 'mailer.node.ts')
    // …and for the shared store: only the Node build bundles the Redis client.
    const storeImpl = resolve(layerDir, 'server/store', dbDriver === 'edge' ? 'store.edge.ts' : 'store.node.ts')

    // Expose the host config + DB driver as virtual aliases to app and Nitro server.
    nuxt.options.alias['#cms/config'] = configPath
    nuxt.options.alias['#cms/db'] = dbImpl
    nuxt.options.alias['#cms/mailer'] = mailImpl
    nuxt.options.alias['#cms/store'] = storeImpl
    // Bundle the host's migrations as server assets so they ship with .output.
    const migrationsDir = resolve(nuxt.options.rootDir, options.migrations?.dir || 'server/db/migrations')
    nuxt.hook('nitro:config', (nitro) => {
      if (existsSync(migrationsDir)) {
        nitro.serverAssets = nitro.serverAssets || []
        nitro.serverAssets.push({ baseName: 'cms-migrations', dir: migrationsDir })
      }
      nitro.alias = nitro.alias || {}
      nitro.alias['#cms/config'] = configPath
      nitro.alias['#cms/db'] = dbImpl
      nitro.alias['#cms/mailer'] = mailImpl
      nitro.alias['#cms/store'] = storeImpl
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
    cms?: { uid: string; sv: number }
  }
}
declare module 'nitropack/types' {
  interface NitroRuntimeHooks {
    /** A content change was saved (see CmsChange). Runs on the instance that saved it. */
    'cms:change': (change: import('@my-cms/core').CmsChange) => void | Promise<void>
  }
}
export {}
`,
    }, { nitro: true, nuxt: true })

    // Runtime config consumed by the server DataSource (env override: NUXT_CMS_DATABASE_URL).
    nuxt.options.runtimeConfig.cms = {
      // Never read DATABASE_URL here: this runs at BUILD time and would bake the build
      // machine's database into the output. useCms() reads the env at runtime.
      databaseUrl: options.databaseUrl || '',
      migrations: { onStart: options.migrations?.onStart ?? false },
      redis: { url: options.redis?.url || '', prefix: options.redis?.prefix || '' },
      // Empty defaults so NUXT_CMS_WEBHOOKS_URLS / NUXT_CMS_WEBHOOKS_SECRET bind at runtime.
      webhooks: {
        urls: (Array.isArray(options.webhooks?.urls) ? options.webhooks.urls.join(',') : options.webhooks?.urls) || '',
        secret: options.webhooks?.secret || '',
      },
      auth: {
        mode: options.auth?.mode || 'builtin',
        trustedProxies: options.auth?.trustedProxies ?? 1,
        ipHeader: options.auth?.ipHeader || '',
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
        },
        maxSizeMb: options.storage?.maxSizeMb ?? 10,
        maxBytesPerUser: options.storage?.maxBytesPerUser ?? 0,
        uploadRatePerMin: options.storage?.uploadRatePerMin ?? 60,
      },
      content: {
        // Empty so NUXT_CMS_CONTENT_TOKEN can bind at runtime; '' = open API.
        token: options.content?.token || '',
        cacheControl: options.content?.cacheControl || '',
        publicUrl: options.content?.publicUrl || '',
      },
      ...(nuxt.options.runtimeConfig.cms as Record<string, unknown> | undefined),
    }
  },
})
