import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'

// The API report: what a package entry point exports, as text, for a golden file.
//
// It reads the declarations with the TypeScript compiler (the same one `pnpm typecheck`
// uses), so a change to a signature, a type, an option or a return type shows up as a
// readable diff. Exports tagged `@internal` in their JSDoc are not part of the public API:
// they are listed by name only, and members of a public interface tagged `@internal` are
// left out. Re-exports from other packages (drizzle's `eq`, `sql`…) are listed by name:
// their types belong to that package.
//
// Used by test/unit/api-surface.spec.ts; see "Contracts" in CONTRIBUTING.md.

export interface ApiEntry {
  /** What it is imported as: `tinyzoo`, `tinyzoo/forms`, `@tinyzoo/client`. */
  name: string
  /** The file `exports` points at, relative to the repository root. */
  file: string
  /** One line for the head of the report. */
  about: string
  /** Print only these exports (the rest of the file's exports are not part of this entry). */
  only?: string[]
  /** What to print for an export instead of its declaration (a Nuxt module's default export, whose type belongs to Nuxt). */
  notes?: Record<string, string>
}

/** The entry points of the two packages: what their `exports` map names (`package.json` of each package). */
export const API_ENTRIES: (ApiEntry & { golden: string })[] = [
  { name: 'tinyzoo', file: 'packages/cms/src/index.ts', golden: 'api-tinyzoo.txt', about: 'The config API (defineEntity, f.*, presets, plugins, seeds), the types of hooks and webhooks, and what the server and CLI share.' },
  { name: 'tinyzoo/forms', file: 'packages/cms/forms/index.ts', golden: 'api-tinyzoo-forms.txt', about: 'The forms plugin: defineForm, defineFormSettings, formsPlugin.' },
  {
    name: 'tinyzoo/module', file: 'packages/cms/module.ts', golden: 'api-tinyzoo-module.txt', only: ['CmsModuleOptions', 'default'],
    about: 'The Nuxt module (build-time wiring): its options are the `cms` key of nuxt.config.',
    notes: { default: "the Nuxt module: meta { name: 'tinyzoo', configKey: 'cms' }, options CmsModuleOptions" },
  },
  { name: '@tinyzoo/client', file: 'packages/client/src/index.ts', golden: 'api-client.txt', about: 'The typed content-API client: createCmsClient, CmsError, cmsMenuTree and the types the generated bindings use.' },
]

export interface ApiExport {
  name: string
  kind: 'function' | 'class' | 'interface' | 'type' | 'const' | 'enum' | 'namespace' | 're-export' | 'other'
  internal: boolean
  deprecated: boolean
  /** The declaration as text (empty for internal exports and re-exports). */
  text: string
  /** Members of an interface marked `@deprecated`, as `Name.member`. */
  deprecatedMembers: string[]
}

const root = resolve(import.meta.dirname, '../..')

let cached: { program: ts.Program; key: string } | undefined

function createProgram(files: string[]): ts.Program {
  const key = files.join('\n')
  if (cached?.key === key) return cached.program
  const configFile = ts.readConfigFile(resolve(root, 'tsconfig.json'), ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root)
  const program = ts.createProgram({ rootNames: files, options: { ...parsed.options, noEmit: true } })
  cached = { program, key }
  return program
}

const tagNames = (symbol: ts.Symbol, checker: ts.TypeChecker) => new Set(symbol.getJsDocTags(checker).map((t) => t.name))

function kindOf(symbol: ts.Symbol): ApiExport['kind'] {
  const f = symbol.flags
  if (f & ts.SymbolFlags.Function) return 'function'
  if (f & ts.SymbolFlags.Class) return 'class'
  if (f & ts.SymbolFlags.Interface) return 'interface'
  if (f & ts.SymbolFlags.TypeAlias) return 'type'
  if (f & ts.SymbolFlags.Enum) return 'enum'
  if (f & ts.SymbolFlags.Variable) return 'const'
  if (f & ts.SymbolFlags.Namespace) return 'namespace'
  return 'other'
}

const dropInternalMembers = <T extends ts.NamedDeclaration>(members: readonly T[]): T[] =>
  members.filter((m) => !ts.getJSDocTags(m).some((t) => t.tagName.text === 'internal'))

/** One declaration as normalised source text: no comments, no `@internal` members. */
function printDeclaration(decl: ts.Declaration, printer: ts.Printer): string {
  const sf = decl.getSourceFile()
  const clean = (node: ts.Node): ts.Node => {
    if (ts.isInterfaceDeclaration(node)) {
      return ts.factory.updateInterfaceDeclaration(node, node.modifiers, node.name, node.typeParameters, node.heritageClauses, dropInternalMembers(node.members as ts.NodeArray<ts.TypeElement>))
    }
    if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
      return ts.factory.updateTypeAliasDeclaration(node, node.modifiers, node.name, node.typeParameters, ts.factory.updateTypeLiteralNode(node.type, ts.factory.createNodeArray(dropInternalMembers(node.type.members))))
    }
    if (ts.isClassDeclaration(node)) {
      return ts.factory.updateClassDeclaration(node, node.modifiers, node.name, node.typeParameters, node.heritageClauses, dropInternalMembers(node.members as ts.NodeArray<ts.ClassElement>))
    }
    return node
  }
  const text = printer.printNode(ts.EmitHint.Unspecified, clean(decl), sf)
  return text.replace(/\n\s*\n/g, '\n')
}

const nodeFlags = ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.MultilineObjectLiterals | ts.NodeBuilderFlags.UseAliasDefinedOutsideCurrentScope

function functionText(decl: ts.FunctionDeclaration, checker: ts.TypeChecker, printer: ts.Printer): string {
  const sig = checker.getSignatureFromDeclaration(decl)
  if (!sig) return `export function ${decl.name?.text}(…)`
  const node = checker.signatureToSignatureDeclaration(sig, ts.SyntaxKind.FunctionDeclaration, decl, nodeFlags) as ts.FunctionDeclaration
  const named = ts.factory.createFunctionDeclaration([ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)], undefined, decl.name?.text, node.typeParameters, node.parameters, node.type, undefined)
  return printer.printNode(ts.EmitHint.Unspecified, named, decl.getSourceFile()).replace(/ \{\s*\}$/, ';')
}

function constText(symbol: ts.Symbol, decl: ts.Declaration, checker: ts.TypeChecker, printer: ts.Printer): string {
  const type = checker.getTypeOfSymbolAtLocation(symbol, decl)
  const node = checker.typeToTypeNode(type, decl, nodeFlags)
  return `export const ${symbol.name}: ${node ? printer.printNode(ts.EmitHint.Unspecified, node, decl.getSourceFile()) : 'unknown'};`
}

const exportsSeen = new Map<string, ApiExport[]>()

/**
 * What the module exports, sorted by name. Building the TypeScript program takes seconds, so
 * each entry is read once per test file (several tests ask for the same entries).
 */
export function apiExports(entry: ApiEntry): ApiExport[] {
  const seen = exportsSeen.get(entry.file)
  if (seen) return seen
  const found = readExports(entry)
  exportsSeen.set(entry.file, found)
  return found
}

function readExports(entry: ApiEntry): ApiExport[] {
  const file = resolve(root, entry.file)
  const program = createProgram([file])
  const checker = program.getTypeChecker()
  const sf = program.getSourceFile(file)
  if (!sf) throw new Error(`apiReport: ${entry.file} is not part of the program`)
  const moduleSymbol = checker.getSymbolAtLocation(sf)
  if (!moduleSymbol) throw new Error(`apiReport: ${entry.file} has no exports`)
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })

  const out: ApiExport[] = []
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    if (entry.only && !entry.only.includes(exported.name)) continue
    const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
    const decls = symbol.declarations ?? []
    const external = decls.length > 0 && decls.every((d) => d.getSourceFile().fileName.includes('/node_modules/'))
    const tags = tagNames(symbol, checker)
    const internal = tags.has('internal')
    const deprecated = tags.has('deprecated')
    if (external) {
      out.push({ name: exported.name, kind: 're-export', internal: false, deprecated: false, text: '', deprecatedMembers: [] })
      continue
    }
    if (entry.notes?.[exported.name]) {
      out.push({ name: exported.name, kind: kindOf(symbol), internal: false, deprecated, text: `export ${exported.name === 'default' ? 'default' : exported.name}: ${entry.notes[exported.name]}`, deprecatedMembers: [] })
      continue
    }
    if (internal) {
      out.push({ name: exported.name, kind: kindOf(symbol), internal: true, deprecated, text: '', deprecatedMembers: [] })
      continue
    }
    const kind = kindOf(symbol)
    const parts: string[] = []
    for (const decl of decls) {
      if (ts.isFunctionDeclaration(decl)) {
        // Overload signatures (no body) and the implementation: print the visible ones.
        if (decls.length > 1 && decl.body) continue
        parts.push(functionText(decl, checker, printer))
      }
      else if (ts.isVariableDeclaration(decl)) parts.push(constText(symbol, decl, checker, printer))
      else if (ts.isExportSpecifier(decl) || ts.isExportAssignment(decl)) parts.push(`export default ${exported.name === 'default' ? '…' : exported.name}`)
      else parts.push(printDeclaration(decl, printer))
    }
    const deprecatedMembers: string[] = []
    for (const decl of decls) {
      if (!ts.isInterfaceDeclaration(decl)) continue
      for (const m of decl.members) {
        const tags = ts.getJSDocTags(m).map((t) => t.tagName.text)
        if (tags.includes('deprecated') && !tags.includes('internal') && m.name) deprecatedMembers.push(`${exported.name}.${m.name.getText()}`)
      }
    }
    out.push({ name: exported.name, kind, internal: false, deprecated, text: parts.join('\n'), deprecatedMembers })
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

/** The golden text of one entry point. */
export function apiReport(entry: ApiEntry): string {
  const exports = apiExports(entry)
  const pub = exports.filter((e) => !e.internal && e.kind !== 're-export')
  const reexports = exports.filter((e) => e.kind === 're-export')
  const internal = exports.filter((e) => e.internal)
  const lines: string[] = [
    `// API report: \`${entry.name}\` (${entry.file})`,
    `// ${entry.about}`,
    '// Part of the frozen API from 1.0 (CONTRIBUTING.md, "Contracts"). Accept a change with `pnpm contracts:update`.',
    '',
    `// ── public (${pub.length}) ─────────────────────────────────────────────────`,
  ]
  for (const e of pub) {
    lines.push('', ...(e.deprecated ? ['/** @deprecated */'] : []), e.text)
  }
  if (reexports.length) {
    lines.push('', `// ── re-exported from other packages (${reexports.length}) ───────────────────────────`, reexports.map((e) => e.name).join(', '))
  }
  const deprecated = [...pub.filter((e) => e.deprecated).map((e) => e.name), ...pub.flatMap((e) => e.deprecatedMembers)]
  if (deprecated.length) {
    lines.push('', `// ── deprecated (${deprecated.length}): still part of the API, to be removed in the release named in its @deprecated tag ──`, ...deprecated)
  }
  lines.push('', `// ── internal (${internal.length}): exported, not part of the frozen API, may change in any minor ──`, ...internal.map((e) => `${e.kind} ${e.name}`))
  return `${lines.join('\n')}\n`
}

/**
 * The server helpers a plugin's route may call (docs/api-surface.md, "Server helpers for plugins"): `useCms()`
 * and `requireCmsUser(event)` with the `CmsUser` it returns. They live in `packages/cms/server/utils` (Nitro
 * auto-imports them), not in an entry point, so they get their own report. The properties `useCms()` returns
 * are written out with their full types: `db` is declared as `ReturnType<typeof createCmsDb>`, and a change
 * to that function should show here too.
 */
export const SERVER_HELPERS: { file: string; only: string[] }[] = [
  { file: 'packages/cms/server/utils/cmsDb.ts', only: ['useCms'] },
  { file: 'packages/cms/server/utils/cmsSession.ts', only: ['requireCmsUser', 'CmsUser'] },
]

export function serverHelpersReport(): string {
  const lines: string[] = [
    '// The server helpers for plugins: what a plugin\'s route may call without an import (docs/api-surface.md,',
    '// "Server helpers for plugins"). Frozen from 1.0: useCms() returns at least { db, reg }; requireCmsUser(event)',
    '// returns the signed-in CmsUser or throws (401 signed out, 403 role-removed). Every other helper in',
    '// packages/cms/server/utils is the server\'s own and may change in any minor. `db` is drizzle\'s: its type',
    '// follows drizzle-orm. Accept a change with `pnpm contracts:update`.',
  ]
  for (const { file, only } of SERVER_HELPERS) {
    const exports = apiExports({ name: file, file, about: '', only })
    const missing = only.filter((n) => !exports.some((e) => e.name === n))
    if (missing.length) throw new Error(`serverHelpersReport: ${file} no longer exports ${missing.join(', ')}`)
    lines.push('', `// ${file}`)
    for (const e of exports) lines.push('', e.text)
    if (only.includes('useCms')) {
      const program = createProgram([resolve(root, file)])
      const checker = program.getTypeChecker()
      const sf = program.getSourceFile(resolve(root, file))!
      const symbol = checker.getExportsOfModule(checker.getSymbolAtLocation(sf)!).find((s) => s.name === 'useCms')!
      const [sig] = checker.getSignaturesOfType(checker.getTypeOfSymbolAtLocation(symbol, sf), ts.SignatureKind.Call)
      const returned = checker.getReturnTypeOfSignature(sig!)
      lines.push('// what it returns, in full:')
      for (const p of returned.getProperties()) {
        lines.push(`//   ${p.name}: ${checker.typeToString(checker.getTypeOfSymbolAtLocation(p, sf), undefined, ts.TypeFormatFlags.NoTruncation)}`)
      }
    }
  }
  return `${lines.join('\n')}\n`
}

/** Names of the public exports of an entry (not `@internal`, not re-exported from another package). */
export const publicExportNames = (entry: ApiEntry): string[] => apiExports(entry).filter((e) => !e.internal).map((e) => e.name)

export const repoRoot = root
export const relativeToRoot = (path: string) => relative(root, path)
export const dirOf = (path: string) => dirname(path)
