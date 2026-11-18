import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

// The frontend kit as text, for a golden file (test/contracts/frontend-kit.txt): the components and
// composables every website uses. Components are `.vue` files, which the TypeScript API does not
// read, so the `<script>` block is cut out and parsed as TypeScript: what it declares with
// `defineProps` / `defineEmits` / `props:` is the component's API. The prop types are interfaces in
// `packages/cms/src/frontend.ts` (exported from `tinyzoo`), printed here in full.
//
// Used by test/unit/frontend-kit.spec.ts; see "Contracts" in CONTRIBUTING.md.

const root = resolve(import.meta.dirname, '../..')
const cms = (p: string) => resolve(root, 'packages/cms', p)

export interface KitComponent { tag: string; file: string; about: string }
export interface KitComposable { name: string; file: string; about: string }

/** The frozen kit. A component or composable every site uses belongs here and in docs/api-surface.md. */
export const KIT_COMPONENTS: KitComponent[] = [
  { tag: 'CmsBlocks', file: 'app/components/CmsBlocks.vue', about: 'A page\'s blocks, each drawn by the site\'s own global component `<prefix><Type>`, which receives `block` and `index` (CmsBlockProps).' },
  { tag: 'CmsImage', file: 'app/components/CmsImage.vue', about: 'A picture with its alt text, real size, lazy loading, `srcset` and focal point.' },
  { tag: 'CmsContent', file: 'app/components/CmsContent.vue', about: 'A rich-text value as sanitised HTML in a `div.cms-content`.' },
  { tag: 'CmsNav', file: 'app/components/CmsNav.vue', about: 'A menu as a `nav.cms-nav` with nested lists.' },
  { tag: 'CmsHighlight', file: 'app/components/CmsHighlight.vue', about: 'Text with `<mark>` around the searched words.' },
  { tag: 'CmsForm', file: 'forms/components/CmsForm.vue', about: 'A website form by name (`tinyzoo/forms`; needs `formsPlugin()`).' },
]

export const KIT_COMPOSABLES: KitComposable[] = [
  { name: 'useCmsSeo', file: 'app/composables/useCmsSeo.ts', about: 'The page\'s head from a content item: title, description, image, canonical, hreflang, og:*.' },
  { name: 'useCmsSearch', file: 'app/composables/useCmsSearch.ts', about: 'The website search: reactive results with address and snippet.' },
  { name: 'useCmsUiLocale', file: 'app/composables/useCmsUiLocale.ts', about: 'Nuxt UI\'s own words in the admin\'s language on /admin pages; for `<UApp :locale>`.' },
]

const parse = (name: string, text: string) => ts.createSourceFile(name, text, ts.ScriptTarget.ES2023, true, ts.ScriptKind.TS)
const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

/** The text of every `<script …>` block of a `.vue` file (the setup block and a plain one, if both). */
function scriptOf(vue: string): string {
  return [...vue.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!).join('\n')
}

function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node)
  ts.forEachChild(node, (c) => walk(c, visit))
}

/** The names declared in `src/frontend.ts`, with their declarations printed without comments. */
function frontendDeclarations(): Map<string, string> {
  const sf = parse('frontend.ts', readFileSync(cms('src/frontend.ts'), 'utf8'))
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })
  const all = new Map<string, string>()
  for (const st of sf.statements) {
    if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) all.set(st.name.text, printer.printNode(ts.EmitHint.Unspecified, st, sf).replace(/\n\s*\n/g, '\n'))
  }
  return all
}

/** An interface or type alias of `src/frontend.ts`, and the ones of that file it names, printed without comments. */
function frontendType(name: string): string {
  const all = frontendDeclarations()
  if (!all.has(name)) throw new Error(`frontend-kit: ${name} is not declared in packages/cms/src/frontend.ts`)
  const order: string[] = []
  const add = (n: string) => {
    if (order.includes(n)) return
    order.push(n)
    for (const m of all.get(n)!.matchAll(/\b(Cms\w+)\b/g)) if (all.has(m[1]!)) add(m[1]!)
  }
  add(name)
  return order.map((n) => all.get(n)!).join('\n')
}

export interface ComponentApi {
  /** The type the component declares its props with (a name from src/frontend.ts), or null when it lists them inline. */
  propsType: string | null
  /** `defineProps<…>()`'s type argument or the `props:` option, as written. */
  propsText: string
  defaults: string | null
  emits: string[]
  slots: string[]
}

export function componentApi(file: string): ComponentApi {
  const source = readFileSync(cms(file), 'utf8')
  const sf = parse(file, scriptOf(source))
  let propsText = ''
  let defaults: string | null = null
  const emits: string[] = []
  walk(sf, (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const fn = n.expression.text
      if (fn === 'defineProps' && n.typeArguments?.[0]) propsText = squash(n.typeArguments[0].getText(sf))
      if (fn === 'withDefaults' && n.arguments[1]) defaults = squash(n.arguments[1].getText(sf))
      if (fn === 'defineEmits' && n.typeArguments?.[0]) {
        const t = n.typeArguments[0]
        if (ts.isTypeLiteralNode(t)) for (const m of t.members) emits.push(squash(m.getText(sf)))
        else emits.push(squash(t.getText(sf)))
      }
    }
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === 'props' && !propsText) propsText = squash(n.initializer.getText(sf))
  })
  const template = source.replace(/<script\b[\s\S]*?<\/script>/g, '')
  const slots = [...template.matchAll(/<slot\b([^>]*)>/g)].map((m) => /\bname="([^"]+)"/.exec(m[1]!)?.[1] ?? 'default')
  return { propsType: /^[A-Z]\w*$/.test(propsText) ? propsText : null, propsText, defaults, emits, slots: [...new Set(slots)] }
}

export interface ComposableApi { signature: string; returns: string[] }

export function composableApi(name: string, file: string): ComposableApi {
  const sf = parse(file, readFileSync(cms(file), 'utf8'))
  for (const st of sf.statements) {
    if (!ts.isFunctionDeclaration(st) || st.name?.text !== name || !st.body) continue
    const isExported = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (!isExported) continue
    const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })
    const bare = ts.factory.updateFunctionDeclaration(st, st.modifiers, st.asteriskToken, st.name, st.typeParameters, st.parameters, st.type, undefined)
    const signature = squash(printer.printNode(ts.EmitHint.Unspecified, bare, sf).replace(/;\s*$/, ''))
    const returns: string[] = []
    // The keys of the object the function returns (the last `return { … }` of its own body, not of a nested function).
    const visit = (n: ts.Node, nested: boolean) => {
      if (ts.isFunctionLike(n) && n !== st) nested = true
      if (!nested && ts.isReturnStatement(n) && n.expression && ts.isObjectLiteralExpression(n.expression)) {
        returns.length = 0
        for (const p of n.expression.properties) returns.push(p.name ? p.name.getText(sf) : p.getText(sf))
      }
      ts.forEachChild(n, (c) => visit(c, nested))
    }
    visit(st.body, false)
    return { signature, returns }
  }
  throw new Error(`frontend-kit: ${file} exports no function ${name}`)
}

/** The kit as a text: one section per component and composable, with the prop types in full. */
export function frontendKitReport(): string {
  const out: string[] = [
    '// The frontend kit: the components and composables every website draws its content with.',
    '// Part of the frozen API from 1.0 (docs/api-surface.md, CONTRIBUTING.md "Contracts"). Accept a change with `pnpm contracts:update`.',
    '// Props are the interfaces of packages/cms/src/frontend.ts (exported from `tinyzoo`); the components declare their props with them.',
    '',
    '// ── components ─────────────────────────────────────────────────',
  ]
  for (const c of KIT_COMPONENTS) {
    const api = componentApi(c.file)
    out.push('', `// <${c.tag}> (${c.file}): ${c.about}`)
    const named = api.propsType ?? /\bCms\w+Props\b/.exec(api.propsText)?.[0]
    if (named) out.push(frontendType(named))
    if (!api.propsType) out.push(`props: ${api.propsText}`)
    if (api.defaults) out.push(`defaults: ${api.defaults}`)
    out.push(`emits: ${api.emits.length ? api.emits.join('; ') : 'none'}`)
    out.push(`slots: ${api.slots.length ? api.slots.join(', ') : 'none'}`)
  }
  out.push('', '// ── what a component of the site receives ──────────────────────', '', frontendType('CmsBlockProps'))
  out.push('', '// ── composables ────────────────────────────────────────────────')
  for (const c of KIT_COMPOSABLES) {
    const api = composableApi(c.name, c.file)
    out.push('', `// ${c.name} (${c.file}): ${c.about}`, `${api.signature}`, `returns: ${api.returns.length ? `{ ${api.returns.join(', ')} }` : 'a value (see the signature)'}`)
  }
  out.push('', '// ── the data types of the kit ───────────────────────────────────', '', frontendType('CmsSearchItem'), '', frontendType('CmsSearchResult'))
  return `${out.join('\n')}\n`
}
