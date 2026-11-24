import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// No module-level state in the server code that is not declared.
//
// One process may serve many sites (packages/cms/server/utils/cmsSite.ts). A plain
// module-level `let`, Map or array is shared by all of them: a cache written for one site
// would be read for another. So every piece of state kept at module level says what it is:
//   - `cmsSiteScoped(() => …)`: a value per site;
//   - `cmsProcessWide(…, 'why')`: shared by the whole process on purpose.
// This spec reads the server files and fails on anything else. A constant (an UPPER_CASE
// table or set of literals, a function, a string) is not state and passes.
//
// The list below holds what may stay as it is, each with its reason. Add to it only with a
// reason that holds for many sites in one process.
const root = join(import.meta.dirname, '../..')
const FOLDERS = ['packages/cms/server', 'packages/cms/analytics', 'packages/cms/consent', 'packages/cms/forms']

const ALLOWED: Record<string, string> = {
  // The seam itself: the async context, the site directory, the instances of the sites and the mode are the process's.
  'packages/cms/server/utils/cmsSite.ts': 'the seam: the site directory, the sites loaded in this process and the mode',
  // Files the CLI loads too (explicit imports only, no Nitro helpers): each is derived from the build, not from a site.
  'packages/cms/analytics/runtime.ts#adminTimeZone': 'the admin\'s time zone from the build\'s app config, the same for every site of the build',
  'packages/cms/analytics/core/visitor.ts#dayFormats': 'date formatters by time zone',
  'packages/cms/analytics/options.ts#settled': 'options settled once per options object of the build',
  'packages/cms/server/utils/cmsEmails.ts#copy': 'the texts of the e-mails per language: a table of the build, never written to',
}

const CONTAINERS = new Set(['Map', 'Set', 'WeakMap', 'WeakSet', 'Array', 'Object'])
/** `new X()` of these is a tool, not a store. */
const HARMLESS = new Set(['TextEncoder', 'TextDecoder', 'RegExp', 'URL', 'Date', 'AsyncLocalStorage', 'Error'])
const DECLARED = new Set(['cmsSiteScoped', 'cmsProcessWide'])

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === 'app' || name.startsWith('.')) return []
    return statSync(path).isDirectory() ? files(path) : /\.ts$/.test(name) && !name.endsWith('.d.ts') ? [path] : []
  })
}

function unwrap(node: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node)) node = node.expression
  return node
}

/** Only literals inside (strings, numbers, nested literal lists and tables): a constant. */
function isLiteral(node: ts.Expression): boolean {
  node = unwrap(node)
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) || node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.NullKeyword) return true
  if (ts.isPrefixUnaryExpression(node)) return isLiteral(node.operand as ts.Expression)
  if (ts.isArrayLiteralExpression(node)) return node.elements.every((e) => !ts.isSpreadElement(e) && isLiteral(e))
  if (ts.isObjectLiteralExpression(node)) return node.properties.every((p) => ts.isPropertyAssignment(p) && isLiteral(p.initializer))
  return false
}

function why(name: string, init: ts.Expression | undefined, isConst: boolean): string | null {
  if (!isConst) return 'a module-level let/var'
  if (!init) return null
  const value = unwrap(init)
  const constant = /^[A-Z][A-Z0-9_]*$/.test(name)
  if (ts.isCallExpression(value)) return null // a call: cmsSiteScoped(…), cmsProcessWide(…), or something computed once
  if (ts.isNewExpression(value)) {
    const what = value.expression.getText()
    if (HARMLESS.has(what) || what.startsWith('Intl.')) return null
    if (constant && CONTAINERS.has(what) && (value.arguments ?? []).every(isLiteral)) return null
    return `new ${what}(…) at module level`
  }
  if (ts.isArrayLiteralExpression(value) || ts.isObjectLiteralExpression(value)) {
    if (constant || (isLiteral(value) && !isEmpty(value))) return null
    return `a module-level ${ts.isArrayLiteralExpression(value) ? 'list' : 'object'} that is not a constant`
  }
  return null
}
const isEmpty = (v: ts.Expression) => (ts.isArrayLiteralExpression(v) && !v.elements.length) || (ts.isObjectLiteralExpression(v) && !v.properties.length)

function undeclared(): string[] {
  const found: string[] = []
  for (const folder of FOLDERS) {
    for (const path of files(join(root, folder))) {
      const file = relative(root, path)
      if (ALLOWED[file]) continue
      const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
      for (const statement of source.statements) {
        if (!ts.isVariableStatement(statement)) continue
        const isConst = !!(statement.declarationList.flags & ts.NodeFlags.Const)
        for (const d of statement.declarationList.declarations) {
          const name = d.name.getText()
          const init = d.initializer
          // Declared: wrapped in one of the two helpers.
          if (init && ts.isCallExpression(unwrap(init)) && DECLARED.has((unwrap(init) as ts.CallExpression).expression.getText())) continue
          const reason = why(name, init, isConst)
          if (!reason || ALLOWED[`${file}#${name}`]) continue
          const line = source.getLineAndCharacterOfPosition(d.getStart()).line + 1
          found.push(`${file}:${line} ${name}: ${reason}`)
        }
      }
    }
  }
  return found
}

describe('module-level state in the server code', () => {
  it('is declared: per site (cmsSiteScoped) or shared by the process on purpose (cmsProcessWide)', () => {
    expect(undeclared(), 'wrap each in cmsSiteScoped(() => …) or cmsProcessWide(…, "why"); see packages/cms/server/utils/cmsSite.ts').toEqual([])
  })

  it('finds what it should (the rule itself)', () => {
    const check = (code: string) => {
      const source = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true)
      const d = (source.statements[0] as ts.VariableStatement).declarationList
      const one = d.declarations[0]!
      return why(one.name.getText(), one.initializer, !!(d.flags & ts.NodeFlags.Const))
    }
    expect(check('let cache: string | null = null')).toMatch(/let/)
    expect(check('const hits = new Map<string, number>()')).toMatch(/new Map/)
    expect(check('const seen = new Set()')).toMatch(/new Set/)
    expect(check('const queue = []')).toMatch(/list/)
    expect(check('const state = { running: 0 }')).toBeNull() // a table of literals reads as a constant…
    expect(check('const state = {}')).toMatch(/object/) // …an empty one is waiting to be filled
    expect(check('const state = { at: Date.now() }')).toMatch(/object/)
    expect(check('const SAFE = new Set(["GET", "HEAD"])')).toBeNull()
    expect(check('const safe = new Set(["GET", "HEAD"])')).toMatch(/new Set/)
    expect(check('const RETRY_MS = [1000, 2000]')).toBeNull()
    expect(check('const cache = cmsSiteScoped(() => new Map())')).toBeNull()
    expect(check('const queue = cmsProcessWide([], "one queue for the process")')).toBeNull()
    expect(check('const str = (v: unknown) => String(v)')).toBeNull()
    expect(check('const encoder = new TextEncoder()')).toBeNull()
  })
})
