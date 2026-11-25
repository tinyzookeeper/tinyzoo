// What the kit's module (module.ts) works out at build time about a design: a template's
// folder as the one app reads it. Plain functions over files and strings, so the unit specs
// test them without Nuxt (test/unit/template-design.spec.ts).
//
// Words: a *design* is one template's frontend (its id is the template id and the name of its
// content model), a *look* is one of its designs (`atelier`), a *part* is a look's component
// (`atelier/Hero.vue`).
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import MagicString from 'magic-string'

/** One component file of a design, with the name Nuxt would give it in the template's own build. */
export interface DesignComponent {
  /** `AtelierWordmark`, `BlockHero`, `LookEntry`. */
  name: string
  /** Absolute path of the .vue file. */
  file: string
  /** `block`: app/components/global; `part`: app/components/<look>; `root`: app/components itself. */
  kind: 'block' | 'part' | 'root'
  /** The look of a part. */
  look?: string
  /** The part's name within its look (`Wordmark`). */
  part?: string
}

/** A server handler of a design (server/api, server/routes), as Nitro would route it. */
export interface DesignHandler {
  file: string
  route: string
  method?: string
}

export interface DesignScan {
  id: string
  root: string
  components: DesignComponent[]
  /** Look ids: the folders of app/components other than `global`. */
  looks: string[]
  /** A look's stylesheet, app/assets/css/<look>.css, by look id (when it exists). */
  css: Record<string, string>
  handlers: DesignHandler[]
  /** Server folders the one app does not carry for a design (plugins, middleware…): a build that meets one stops. */
  unsupported: string[]
}

const PASCAL_SPLIT = /[-_\s]+|(?<=[a-z0-9])(?=[A-Z])/

/** `sports-club` → `SportsClub`, `atelier` → `Atelier`. */
export function pascalId(id: string): string {
  return id.split(PASCAL_SPLIT).filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1)).join('')
}

/**
 * The name Nuxt gives a component file (its default `pathPrefix`): `atelier/Hero.vue` →
 * `AtelierHero`, `atelier/AtelierHero.vue` → `AtelierHero` (a file name that already starts
 * with its folder's name is not prefixed twice), `atelier/index.vue` → `Atelier`.
 * Components in `global/` are named without their folder, as the templates register them.
 */
export function componentName(relPath: string): string {
  const parts = relPath.replace(/\\/g, '/').replace(/\.vue$/, '').split('/')
  const file = parts.pop()!
  const dirs = parts[0] === 'global' ? parts.slice(1) : parts
  const prefix = dirs.map(pascalId)
  if (file === 'index') return prefix.join('') || 'Index'
  const name = pascalId(file)
  // Drop the folders the file name already starts with (Nuxt's rule, by whole words).
  for (let i = 0; i < prefix.length; i++) {
    const tail = prefix.slice(i).join('')
    if (name.startsWith(tail)) return prefix.slice(0, i).join('') + name
  }
  return prefix.join('') + name
}

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory()
const vueFiles = (dir: string) => (isDir(dir) ? readdirSync(dir).filter((f) => f.endsWith('.vue')).sort() : [])

/** Every .ts/.js file under a folder, recursively, as paths relative to it. */
function filesUnder(dir: string, base = dir): string[] {
  if (!isDir(dir)) return []
  return readdirSync(dir).sort().flatMap((name) => {
    const full = join(dir, name)
    return isDir(full) ? filesUnder(full, base) : /\.[cm]?[jt]s$/.test(name) ? [relative(base, full).split(sep).join('/')] : []
  })
}

/**
 * The address and method of a server handler file, Nitro's way: `gift/[id]/reserve.post.ts`
 * under server/api → `/api/gift/:id/reserve`, `post`; `[...slug].ts` → `/**:slug`; `index` is
 * the folder itself.
 */
export function handlerRoute(relPath: string, base: 'api' | 'routes'): { route: string; method?: string } {
  let path = relPath.replace(/\.[cm]?[jt]s$/, '')
  let method: string | undefined
  const m = /\.(get|post|put|patch|delete|head|options|connect|trace)$/i.exec(path)
  if (m) {
    method = m[1]!.toLowerCase()
    path = path.slice(0, -m[0].length)
  }
  const segments = path.split('/').filter((s) => s !== 'index').map((s) => s
    .replace(/^\[\.\.\.(\w*)\]$/, (_all, name: string) => `**${name ? `:${name}` : ''}`)
    .replace(/\[(\w+)\]/g, ':$1'))
  const route = `${base === 'api' ? '/api' : ''}/${segments.join('/')}`.replace(/\/+$/, '') || '/'
  return { route, method }
}

/** Read a design's folder: its components, looks, look stylesheets and server handlers. */
export function scanDesign(id: string, root: string): DesignScan {
  const componentsDir = join(root, 'app', 'components')
  const components: DesignComponent[] = []
  const looks: string[] = []
  for (const file of vueFiles(componentsDir)) {
    components.push({ name: componentName(file), file: join(componentsDir, file), kind: 'root' })
  }
  for (const dir of isDir(componentsDir) ? readdirSync(componentsDir).sort() : []) {
    if (!isDir(join(componentsDir, dir))) continue
    const global = dir === 'global'
    if (!global) looks.push(dir)
    for (const file of vueFiles(join(componentsDir, dir))) {
      const part = file.replace(/\.vue$/, '')
      components.push({
        name: componentName(`${dir}/${file}`),
        file: join(componentsDir, dir, file),
        kind: global ? 'block' : 'part',
        ...(global ? {} : { look: dir, part }),
      })
    }
  }
  const css: Record<string, string> = {}
  for (const look of looks) {
    const file = join(root, 'app', 'assets', 'css', `${look}.css`)
    if (existsSync(file)) css[look] = file
  }
  const handlers: DesignHandler[] = []
  for (const base of ['api', 'routes'] as const) {
    for (const rel of filesUnder(join(root, 'server', base))) {
      handlers.push({ file: join(root, 'server', base, rel), ...handlerRoute(rel, base) })
    }
  }
  const unsupported = ['plugins', 'middleware', 'utils', 'tasks'].filter((d) => filesUnder(join(root, 'server', d)).length).map((d) => `server/${d}`)
  return { id, root, components, looks, css, handlers, unsupported }
}

/** What would go wrong if these designs were built into one app: mistakes stop the build, oddities are warnings. */
export function checkDesigns(designs: DesignScan[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const lookOwner = new Map<string, string>()
  const routes = new Map<string, string>()
  for (const d of designs) {
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(d.id)) errors.push(`design "${d.id}": an id is 1 to 40 characters of a-z, 0-9 and -, starting with a letter (it is the content model's name)`)
    if (!d.looks.length) errors.push(`design "${d.id}": no look (no folder in app/components besides global)`)
    for (const look of d.looks) {
      const other = lookOwner.get(look)
      if (other) errors.push(`the look "${look}" is in two designs: ${other} and ${d.id}`)
      lookOwner.set(look, d.id)
      if (!d.css[look]) errors.push(`design "${d.id}": the look "${look}" has no stylesheet app/assets/css/${look}.css`)
    }
    for (const dir of d.unsupported) errors.push(`design "${d.id}": ${dir} is not carried by the one app (only server/api and server/routes are)`)
    const names = new Map<string, string>()
    for (const c of d.components) {
      const had = names.get(c.name)
      if (had) errors.push(`design "${d.id}": two components are named ${c.name} (${had} and ${c.file})`)
      names.set(c.name, c.file)
    }
    // Every look has the same parts: a site keeps its content when it changes its look.
    const partsOf = (look: string) => new Set(d.components.filter((c) => c.look === look).map((c) => c.part!))
    const all = new Set(d.looks.flatMap((l) => [...partsOf(l)]))
    for (const look of d.looks) {
      const have = partsOf(look)
      const missing = [...all].filter((p) => !have.has(p))
      if (missing.length) warnings.push(`design "${d.id}": the look "${look}" has no ${missing.map((p) => `${p}.vue`).join(', ')}`)
    }
    for (const h of d.handlers) {
      const key = `${h.method ?? '*'} ${h.route}`
      const other = routes.get(key)
      if (other) errors.push(`two designs answer ${key}: ${other} and ${d.id}`)
      routes.set(key, d.id)
    }
  }
  return { errors, warnings }
}

/**
 * The content types of a design whose names take the prefix of a site's own types (`custom_`, tinyzoo's
 * CUSTOM_PREFIX): such a design leaves no room for them, and its blocks of a site's own types
 * would read its own collections. `names` are the names of the design's content model.
 */
export function customPrefixProblems(design: string, names: string[], prefix: string): string[] {
  return names.filter((n) => n.startsWith(prefix)).map((n) => `design "${design}": its content type "${n}" starts with "${prefix}", the prefix of the types a site makes for itself; rename it`)
}

/** The names of the content types a config exports (`defineEntity`, `defineSingleton`, `definePages`…). */
export function exportedTypeNames(config: Record<string, unknown>): string[] {
  const names = new Set<string>()
  for (const v of Object.values(config ?? {})) {
    if (v && typeof v === 'object' && (v as { __cms?: unknown }).__cms === 'entity' && typeof (v as { name?: unknown }).name === 'string') names.add((v as { name: string }).name)
  }
  return [...names]
}

// `_resolveComponent("AtelierWordmark")`, as the Vue compiler writes a component it does not
// see imported (the same calls Nuxt's own component loader rewrites).
const RESOLVE_RE = /(?<=[\s(=;,])_?resolveComponent\d*\s*\(\s*(["'`])([^'"`]+)\1[^)]*\)/g
const HYDRATION_RE = /^(?:Lazy|lazy-)/

/**
 * Turn the design's own components, used by name in one of its files, into direct imports of
 * that design's files: inside templates/photographer, `<AtelierWordmark>` and `<LookAlbum>` are
 * Photographer's. Other names (`LookPart`, `CmsImage`, `UIcon`) are left to Nuxt. Returns
 * whether anything changed; the imports go to the top of `s`.
 */
export function rewriteComponents(s: MagicString, code: string, own: Map<string, string>, file: string): boolean {
  const imports = new Map<string, string>()
  for (const match of code.matchAll(RESOLVE_RE)) {
    const name = match[2]!
    if (HYDRATION_RE.test(name) && own.has(name.replace(HYDRATION_RE, '').replace(/^(Idle|Visible|Interaction|MediaQuery|If|Never|Time)_?/, ''))) {
      throw new Error(`[tinyzoo] ${file}: <${name}> loads a design's component lazily, which the one app does not support; use the plain name`)
    }
    const target = own.get(name)
    if (!target) continue
    let local = imports.get(target)
    if (!local) {
      local = `__tz_component_${imports.size}`
      imports.set(target, local)
    }
    s.overwrite(match.index!, match.index! + match[0].length, local)
  }
  if (!imports.size) return false
  s.prepend([...imports].map(([target, local]) => `import ${local} from ${JSON.stringify(target)};\n`).join(''))
  return true
}

/** A server handler of a design that answers only on that design's sites (a 404 elsewhere). */
export function guardCode(design: string, handlerFile: string): string {
  return [
    `// Generated by tinyzoo-template-kit: ${design}'s handler, for ${design}'s sites only.`,
    // (Nitro does not add its auto-imports to the files of the build folder.)
    "import { createError, defineEventHandler } from '#imports'",
    `import handler from ${JSON.stringify(handlerFile)}`,
    '',
    'export default defineEventHandler((event) => {',
    `  if (event.context.siteDesign !== ${JSON.stringify(design)}) throw createError({ statusCode: 404, statusMessage: 'Not found' })`,
    '  return handler(event)',
    '})',
    '',
  ].join('\n')
}
