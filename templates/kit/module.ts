// The template kit's build-time part: it tells the website which design draws it.
//
// Two ways to build:
//
//  - A template's own build (templates/<id>, no `templateKit.designs`): one design, the
//    template's own folder. Nuxt names and imports its components and helpers as for any app;
//    `#site` is the template's folder.
//  - The one app (templates/app, `templateKit: { designs: ['photographer', 'wedding'] }`): one
//    build carries several designs and each site is drawn in its own, the one its content
//    model names. Their folders stay where they are and are read from there. Inside a design's
//    folder, the names it uses (`wordsOf`, `useServices`, `<EnquiryFields>`, `<AtelierHero>`) are
//    that design's own, the way they are in its own build; its blocks are registered as
//    `<Id>Block<Type>`; each look's stylesheet is a file of its own, linked only on that look's
//    pages; a design's server handlers answer only on its sites.
//
// Both ways write `#tz-designs`, the designs the build carries, each loaded when a site of it
// is first drawn (app/plugins/design.ts, app/utils/design.ts).
import { existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addBuildPlugin, addComponent, addServerHandler, addTemplate, addTypeTemplate, defineNuxtModule, useLogger } from '@nuxt/kit'
import { optimize } from '@tailwindcss/node'
import MagicString from 'magic-string'
import { createUnimport, scanDirExports, type Unimport } from 'unimport'
import { checkDesigns, guardCode, pascalId, rewriteComponents, scanDesign, type DesignScan } from './design-build'

export interface TemplateKitOptions {
  /** The designs (template ids) of the one app. Not set: a template's own build. */
  designs?: string[]
  /** Where the designs' folders are: the folder of templates (default: the kit's parent folder). */
  templatesDir?: string
}

const kitDir = dirname(fileURLToPath(import.meta.url))
const LOOK_CSS_ID = 'virtual:tz-look-css:'
const HELPER_DIRS = ['app/composables', 'app/utils']
const HELPER_FILES = ['*.{ts,js,mjs,mts}', '*/index.{ts,js,mjs,mts}']

/** The generated module of one design: what `defineDesign` gets. Paths are absolute. */
function designModule(d: DesignScan, oneApp: boolean): string {
  const lines = [
    `import { defineDesign } from ${JSON.stringify(join(kitDir, 'app/utils/design.ts'))}`,
    `import { DEFAULT_LANGUAGE, ENTRY_PAGES, wordsOf } from ${JSON.stringify(join(d.root, 'app/utils/site.ts'))}`,
    `import { looks } from ${JSON.stringify(join(d.root, 'looks.ts'))}`,
  ]
  // The looks' stylesheets (the one app only): their addresses, from tinyzoo:look-css-url below.
  if (oneApp) lines.push(`import css from ${JSON.stringify(`${LOOK_CSS_ID}${d.id}`)}`)
  const entry = oneApp ? d.components.find((c) => c.kind === 'root' && c.name === 'LookEntry') : undefined
  const parts = d.components.filter((c) => c.kind === 'part')
    .map((c) => `    ${JSON.stringify(`${c.look}/${c.part}`)}: () => import(${JSON.stringify(c.file)}),`)
  lines.push(
    '',
    'export default defineDesign({',
    `  id: ${JSON.stringify(d.id)},`,
    `  blockPrefix: ${JSON.stringify(oneApp ? `${pascalId(d.id)}Block` : 'Block')},`,
    '  site: { DEFAULT_LANGUAGE, ENTRY_PAGES, wordsOf },',
    '  looks,',
    ...(entry ? [`  entry: () => import(${JSON.stringify(entry.file)}),`] : []),
    '  parts: {',
    ...parts,
    '  },',
    `  css: ${oneApp ? 'css' : '{}'},`,
    '})',
    '',
  )
  return lines.join('\n')
}

export default defineNuxtModule<TemplateKitOptions>({
  meta: { name: 'tinyzoo-template-kit', configKey: 'templateKit' },
  defaults: {},
  async setup(options, nuxt) {
    const logger = useLogger('tinyzoo')
    const oneApp = Array.isArray(options.designs)
    const templatesDir = resolve(options.templatesDir ?? join(kitDir, '..'))
    // A template's own build: the template is the app, and `#site` its folder (the kit's own
    // files name the template's through it; `~` is the kit's folder in them).
    if (!oneApp) nuxt.options.alias['#site'] = nuxt.options.rootDir
    const designs = oneApp
      ? options.designs!.map((id) => scanDesign(id, join(templatesDir, id)))
      : [scanDesign(basename(nuxt.options.rootDir), nuxt.options.rootDir)]

    if (oneApp) {
      for (const d of designs) {
        if (!existsSync(join(d.root, 'looks.ts'))) throw new Error(`[tinyzoo] design "${d.id}": ${d.root}/looks.ts is missing`)
      }
      const { errors, warnings } = checkDesigns(designs)
      for (const w of warnings) logger.warn(w)
      if (errors.length) throw new Error(`[tinyzoo] the designs cannot be built together:\n  ${errors.join('\n  ')}`)
    }

    // The designs this build carries, each a chunk of its own, loaded when a site of it is drawn.
    for (const d of designs) addTemplate({ filename: `tz/design-${d.id}.mjs`, getContents: () => designModule(d, oneApp) })
    const registry = addTemplate({
      filename: 'tz/designs.mjs',
      getContents: () => [
        `export const oneApp = ${oneApp}`,
        'export const designs = {',
        ...designs.map((d) => `  ${JSON.stringify(d.id)}: () => import('#build/tz/design-${d.id}.mjs').then((m) => m.default),`),
        '}',
        '',
      ].join('\n'),
    })
    nuxt.options.alias['#tz-designs'] = registry.dst
    addTypeTemplate({
      filename: 'types/tz-designs.d.ts',
      getContents: () => [
        'declare module \'#tz-designs\' {',
        `  import type { Design } from ${JSON.stringify(join(kitDir, 'app/utils/design'))}`,
        '  /** Whether this is the one app (several designs, each site drawn in its own) or a template\'s own build. */',
        '  export const oneApp: boolean',
        '  export const designs: Record<string, () => Promise<Design>>',
        '}',
        '',
      ].join('\n'),
    }, { nuxt: true, nitro: false })

    if (!oneApp) return

    // ── the one app ──

    const shortNames = new Map(designs.map((d) => [d.id, new Map(d.components.map((c) => [c.name, c.file]))]))

    // Blocks are found by name (<CmsBlocks :prefix>): registered globally, with the design in front.
    for (const d of designs) {
      for (const c of d.components.filter((c) => c.kind === 'block')) {
        await addComponent({ name: `${pascalId(d.id)}${c.name}`, filePath: c.file, global: true })
      }
    }

    // Each design's own helpers (app/utils, app/composables), for its own files only. A design's
    // files get one pass with everything Nuxt imports by itself plus the design's own helpers (the
    // design's win a name both have): Nuxt's own pass would leave a compiled template alone once
    // another pass has rewritten one of its names.
    let nuxtImports: Unimport | undefined
    nuxt.hook('imports:context', (ctx) => { nuxtImports = ctx })
    const own = new Map(await Promise.all(designs.map(async (d) => [d.id, await scanDirExports(HELPER_DIRS.map((dir) => join(d.root, dir)), { filePatterns: HELPER_FILES })] as const)))
    const contexts = new Map<string, Promise<Unimport>>()
    const contextOf = (d: DesignScan) => {
      let ctx = contexts.get(d.id)
      if (!ctx) {
        ctx = (async () => {
          const mine = own.get(d.id)!
          const names = new Set(mine.map((i) => i.as ?? i.name))
          if (!nuxtImports) throw new Error('[tinyzoo] Nuxt\'s auto-imports are not known yet; the designs\' helpers cannot be scoped')
          const shared = (await nuxtImports.getImports()).filter((i) => !names.has(i.as ?? i.name))
          return createUnimport({ imports: [...shared, ...mine], addons: { vueTemplate: true } })
        })()
        contexts.set(d.id, ctx)
      }
      return ctx
    }
    // In development a changed helper is read again (and Nuxt's own list may have changed too).
    nuxt.hook('builder:watch', async (_event, path) => {
      const file = resolve(nuxt.options.srcDir, path)
      for (const d of designs) {
        if (HELPER_DIRS.some((dir) => file.startsWith(join(d.root, dir) + '/'))) own.set(d.id, await scanDirExports(HELPER_DIRS.map((dir) => join(d.root, dir)), { filePatterns: HELPER_FILES }))
      }
      contexts.clear()
    })
    const scopes = designs.map((d) => ({ d, own: shortNames.get(d.id)! }))
    addBuildPlugin({
      vite: () => ({
        name: 'tinyzoo:design-scope',
        // After Vue has compiled the file, before Nuxt's own component and import passes.
        enforce: 'post',
        async transform(code: string, id: string) {
          const file = id.replace(/\?.*$/, '')
          if (!/\.(vue|[cm]?[jt]s)$/.test(file) || /[?&]type=style/.test(id)) return
          const scope = scopes.find((s) => file.startsWith(`${s.d.root}/`))
          if (!scope || /[\\/](node_modules|\.nuxt|\.output)[\\/]/.test(file)) return
          const s = new MagicString(code)
          const renamed = rewriteComponents(s, code, scope.own, file)
          const result = await (await contextOf(scope.d)).injectImports(renamed ? s.toString() : code, id)
          if (!renamed && !result.s.hasChanged()) return
          return { code: result.s.toString(), map: result.s.generateMap({ hires: true, source: id }) }
        },
      }),
    }, { prepend: true })

    // Each look's stylesheet goes through what Tailwind does to the CSS of a template's own build,
    // where the look is part of main.css: nesting lowered for the same browsers, and a rule the
    // browsers would not take (a @keyframes inside a rule) left out. Then Vite and @nuxt/fonts
    // treat it as any stylesheet (the fonts' @font-face rules go into it). So the look's file
    // holds the same rules as before.
    const lookFiles = new Set(designs.flatMap((d) => Object.values(d.css)))
    // Each look's file is emitted by the browser's build. The server's build would work out
    // another name for it (its CSS is not treated the same), so the server takes the names the
    // browser's build gave (Nuxt builds the browser's part first).
    const emitted = new Map<string, string>()
    const designOfCssId = (id: string) => designs.find((d) => id === `\0${LOOK_CSS_ID}${d.id}`)
    addBuildPlugin({
      vite: () => ({
        name: 'tinyzoo:look-css',
        enforce: 'pre',
        resolveId(id: string) {
          if (id.startsWith(LOOK_CSS_ID)) return `\0${id}`
        },
        load(id: string) {
          const d = designOfCssId(id)
          if (!d) return
          const looks = Object.entries(d.css)
          // Development: the file as Vite serves it (an import would make Nuxt link every look's file).
          if (nuxt.options.dev) {
            return [
              "import { buildAssetsURL } from '#internal/nuxt/paths'",
              `export default { ${looks.map(([look, file]) => `${JSON.stringify(look)}: buildAssetsURL(${JSON.stringify(`@fs${file}`)})`).join(', ')} }`,
            ].join('\n')
          }
          if ((this as any).environment?.name === 'client') {
            // The import makes the build emit the file; it gives a full address (http://host/_nuxt/<name>),
            // while the server writes the address from the app's own base. The link must read the same
            // on both sides, or the browser changes it when it takes the page over and applies the
            // stylesheet a second time: so the name is taken from the import and the address made as the server makes it.
            return [
              "import { buildAssetsURL } from '#internal/nuxt/paths'",
              ...looks.map(([, file], i) => `import css${i} from ${JSON.stringify(`${file}?url`)}`),
              "const sameAsServer = (url) => buildAssetsURL(String(url).replace(/[?#].*$/, '').split('/').pop())",
              `export default { ${looks.map(([look], i) => `${JSON.stringify(look)}: sameAsServer(css${i})`).join(', ')} }`,
            ].join('\n')
          }
          const missing = looks.filter(([, file]) => !emitted.has(file)).map(([look]) => look)
          if (missing.length) throw new Error(`[tinyzoo] design ${d.id}: the browser's build emitted no stylesheet for ${missing.join(', ')}`)
          return [
            "import { buildAssetsURL } from '#internal/nuxt/paths'",
            `export default { ${looks.map(([look, file]) => `${JSON.stringify(look)}: buildAssetsURL(${JSON.stringify(emitted.get(file))})`).join(', ')} }`,
          ].join('\n')
        },
        transform(code: string, id: string) {
          const [file, query = ''] = id.split('?')
          // Not `?url` or `?raw`: those are the modules that hand the file's address or text to the code.
          if (!lookFiles.has(file!) || /(^|&)(url|raw)(&|=|$)/.test(query)) return
          return { code: optimize(code, { file }).code, map: null }
        },
        generateBundle(_options: unknown, bundle: Record<string, any>) {
          if ((this as any).environment?.name !== 'client') return
          const assetsDir = nuxt.options.app.buildAssetsDir.replace(/^\/+|\/+$/g, '')
          for (const out of Object.values(bundle)) {
            if (out.type !== 'asset' || !out.fileName.endsWith('.css')) continue
            for (const original of out.originalFileNames ?? []) {
              const file = resolve(nuxt.options.rootDir, original)
              if (lookFiles.has(file)) emitted.set(file, out.fileName.replace(`${assetsDir}/`, ''))
            }
          }
        },
      }),
    })

    // A design's server handlers answer on its own sites only (server/middleware/design.ts tells which).
    for (const d of designs) {
      d.handlers.forEach((h, i) => {
        const guard = addTemplate({ filename: `tz/server/${d.id}-${i}.ts`, write: true, getContents: () => guardCode(d.id, h.file) })
        addServerHandler({ route: h.route, ...(h.method ? { method: h.method as any } : {}), handler: guard.dst })
      })
    }

    for (const d of designs) {
      const count = (kind: string) => d.components.filter((c) => c.kind === kind).length
      logger.info(`design ${d.id}: ${count('block')} blocks, ${count('part')} parts in ${d.looks.length} looks (${d.looks.join(', ')}), ${count('root')} other components, ${Object.keys(d.css).length} look stylesheets, ${d.handlers.length} server handlers`)
    }
  },
})
