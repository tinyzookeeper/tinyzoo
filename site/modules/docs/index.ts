// The documentation on the website, built from the Markdown in docs/ (the source of truth,
// versioned with the code). At build time (build.ts) every page is rendered to JSON once
// per website language and handed to Nitro as server assets, so it is bundled into
// .output and the server reads it from memory: no docs/ folder, database or extra
// service at runtime. The pictures the pages show are copied next to it and published at
// /docs/img; clips are site/public/docs/clips/<name>.<lang>.mp4. In development the
// Markdown is watched and rendered again on every change.
//
// Server routes: server/api/site-docs (a page, the search). Pages: app/pages/dokumentace.
import { cpSync, existsSync, mkdirSync, rmSync, watch, writeFileSync, type FSWatcher } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { defineNuxtModule, useLogger } from 'nuxt/kit'
import { buildDocs } from './build'

export default defineNuxtModule({
  meta: { name: 'site-docs' },
  setup(_, nuxt) {
    const logger = useLogger('site-docs')
    const root = resolve(nuxt.options.rootDir, '..')
    const clipsDir = join(nuxt.options.rootDir, 'public/docs/clips')
    // Outside .nuxt (which Nuxt clears when it starts a build) and out of git.
    const out = join(nuxt.options.rootDir, 'node_modules/.cache/site-docs')
    const dataDir = join(out, 'data')
    const imgDir = join(out, 'img')

    function write() {
      const t0 = Date.now()
      const built = buildDocs({ root, clipsDir })
      rmSync(out, { recursive: true, force: true })
      for (const [name, value] of built.files) {
        const file = join(dataDir, name)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, JSON.stringify(value))
      }
      for (const [rel, src] of built.images) {
        mkdirSync(dirname(join(imgDir, rel)), { recursive: true })
        cpSync(src, join(imgDir, rel))
      }
      logger.info(`docs: ${built.files.size} files, ${built.images.size} pictures (${Date.now() - t0} ms)`)
    }
    write()

    nuxt.hook('nitro:config', (nitro) => {
      nitro.serverAssets = [...(nitro.serverAssets ?? []), { baseName: 'site-docs', dir: dataDir }]
      nitro.publicAssets = [...(nitro.publicAssets ?? []), { baseURL: '/docs/img', dir: imgDir, maxAge: 60 * 60 * 24 * 7 }]
    })

    if (!nuxt.options.dev) return
    // Development: render again when a page, a picture or a clip changes.
    let timer: ReturnType<typeof setTimeout> | undefined
    const again = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        try { write() } catch (err) { logger.error(`docs: ${(err as Error).message}`) }
      }, 150)
    }
    const publicDir = join(nuxt.options.rootDir, 'public')
    const watchers: FSWatcher[] = [watch(join(root, 'docs'), { recursive: true }, again)]
    // public/, not public/docs/clips: the folder may not exist yet when the first clip arrives.
    if (existsSync(publicDir)) {
      watchers.push(watch(publicDir, { recursive: true }, (_, file) => { if (String(file ?? '').replaceAll('\\', '/').startsWith('docs/clips')) again() }))
    }
    nuxt.hook('close', () => { clearTimeout(timer); for (const w of watchers) w.close() })
  },
})
