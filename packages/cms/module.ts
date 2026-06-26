import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineNuxtModule } from '@nuxt/kit'

export interface CmsModuleOptions {
  /** Path to the host config, relative to rootDir. Default: 'cms.config.ts'. */
  config?: string
  /** Postgres connection string (Node). Falls back to env DATABASE_URL at runtime. */
  databaseUrl?: string
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
    /** Max upload size in MB. Default 10. */
    maxSizeMb?: number
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

    // Expose the host config as #cms/config to both the app and the Nitro server.
    nuxt.options.alias['#cms/config'] = configPath
    nuxt.hook('nitro:config', (nitro) => {
      nitro.alias = nitro.alias || {}
      nitro.alias['#cms/config'] = configPath
      // pg is a Node driver — keep it external in the server bundle.
      nitro.externals = nitro.externals || {}
      nitro.externals.inline = nitro.externals.inline || []
    })

    // Runtime config consumed by the server DataSource (env override: NUXT_CMS_DATABASE_URL).
    nuxt.options.runtimeConfig.cms = {
      databaseUrl: options.databaseUrl || process.env.DATABASE_URL || '',
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
      },
      ...(nuxt.options.runtimeConfig.cms as Record<string, unknown> | undefined),
    }
  },
})
