import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addTypeTemplate, defineNuxtModule } from '@nuxt/kit'

const layerDir = dirname(fileURLToPath(import.meta.url))

export interface CmsModuleOptions {
  /** Path to the host config, relative to rootDir. Default: 'cms.config.ts'. */
  config?: string
  /** Postgres connection string. Falls back to env DATABASE_URL at runtime. */
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
  auth?: { mode?: 'builtin' | 'external' }
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

    // Expose the host config + DB driver as virtual aliases to app and Nitro server.
    nuxt.options.alias['#cms/config'] = configPath
    nuxt.options.alias['#cms/db'] = dbImpl
    nuxt.options.alias['#cms/mailer'] = mailImpl
    nuxt.hook('nitro:config', (nitro) => {
      nitro.alias = nitro.alias || {}
      nitro.alias['#cms/config'] = configPath
      nitro.alias['#cms/db'] = dbImpl
      nitro.alias['#cms/mailer'] = mailImpl
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
    cms?: { sv: number }
  }
}
export {}
`,
    }, { nitro: true, nuxt: true })

    // Runtime config consumed by the server DataSource (env override: NUXT_CMS_DATABASE_URL).
    nuxt.options.runtimeConfig.cms = {
      databaseUrl: options.databaseUrl || process.env.DATABASE_URL || '',
      auth: { mode: options.auth?.mode || 'builtin' },
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
