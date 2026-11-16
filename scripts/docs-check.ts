// The docs check: every code block of docs/guide (and of the README) that carries a `<!-- check: group/path -->`
// marker is written to test/docs/.generated/<group>/, the group's cms.config.ts is loaded
// for real (registry, schema and typed client are built from it), and tsc checks the lot.
// A failure names the Markdown file and line. See test/docs/README.md.
//
//   pnpm docs:check            (runs this under tsx, from packages/cms where tsx lives)
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  assembleGroups, DocsCheckError, extractBlocks, originOf, parseTsc,
  type DocBlock, type GeneratedFile,
} from './docs-check/extract'

const root = join(import.meta.dirname, '..')
const guideDir = join(root, 'docs/guide')
const outDir = join(root, 'test/docs/.generated')
const t0 = Date.now()

function fail(lines: string[]): never {
  console.error(`✗ docs check failed\n\n${lines.join('\n')}\n`)
  process.exit(1)
}

// 1. the blocks
const docs = readdirSync(guideDir).filter((n) => n.endsWith('.md')).sort()
const blocks: DocBlock[] = []
try {
  for (const name of docs) blocks.push(...extractBlocks(readFileSync(join(guideDir, name), 'utf8'), `docs/guide/${name}`))
  // The README's example is the first thing a developer copies.
  blocks.push(...extractBlocks(readFileSync(join(root, 'README.md'), 'utf8'), 'README.md'))
} catch (err) {
  if (err instanceof DocsCheckError) fail([err.message])
  throw err
}
if (!blocks.length) {
  console.log('docs check: no marked code blocks in docs/guide')
  process.exit(0)
}
for (const b of blocks) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(b.group)) fail([`${b.doc}:${b.markerLine}: the group "${b.group}" must be lowercase letters, digits and dashes`])
}

// 2. the files of each group (`~/` becomes a relative path: one tsconfig serves every group)
const starterPath = 'packages/cms/starter/cms.config.ts'
let groups: Map<string, GeneratedFile[]>
try {
  groups = assembleGroups(blocks, { source: starterPath, text: readFileSync(join(root, starterPath), 'utf8') })
} catch (err) {
  if (err instanceof DocsCheckError) fail([err.message])
  throw err
}
rmSync(outDir, { recursive: true, force: true })
const written = new Map<string, GeneratedFile>() // path relative to the repo root → file
for (const [group, files] of groups) {
  if (!files.some((f) => f.path === 'cms.config.ts')) {
    const first = blocks.find((b) => b.group === group)!
    fail([`${first.doc}:${first.markerLine}: the group "${group}" has no cms.config.ts block (the typed client is generated from it)`])
  }
  for (const file of files) {
    const target = join(outDir, group, file.path)
    const toApp = relative(dirname(target), join(outDir, group, 'app')) || '.'
    const content = file.content.replace(/(\bfrom\s+|\bimport\(\s*)(['"])~\//g, (_m, a: string, q: string) => `${a}${q}${toApp.startsWith('.') ? toApp : `./${toApp}`}/`)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
    written.set(relative(root, target), { ...file, content })
  }
}

// 3. each group's config, for real: the registry, the schema and the typed client
const problems: string[] = []
for (const [group, files] of groups) {
  const where = blocks.filter((b) => b.group === group && b.path === 'cms.config.ts').map((b) => `${b.doc}:${b.markerLine}`).join(', ')
  try {
    const { buildRegistry, emitSchema, emitContentTypes } = await import('tinyzoo')
    const config = await import(pathToFileURL(join(outDir, group, 'cms.config.ts')).href)
    buildRegistry(config)
    emitSchema(config)
    const client = join(outDir, group, 'app/lib/cms-content.ts')
    mkdirSync(dirname(client), { recursive: true })
    writeFileSync(client, emitContentTypes(config))
  } catch (err) {
    problems.push(`[${group}] cms.config.ts (${where}) does not load: ${(err as Error).message}`)
  }
  void files
}
if (problems.length) fail(problems)

// 4. the types
const tsc = createRequire(join(root, 'package.json')).resolve('typescript/bin/tsc')
const run = spawnSync(process.execPath, [tsc, '-p', 'test/docs/tsconfig.json', '--noEmit', '--pretty', 'false'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const output = `${run.stdout}${run.stderr}`
if (run.status !== 0) {
  const issues = parseTsc(output)
  if (!issues.length) fail([output.trim() || `tsc exited with ${run.status}`])
  fail(issues.map((i) => {
    const file = written.get(i.file)
    const origin = file ? originOf(file, i.line) : null
    const place = origin ? `${origin.source}:${origin.line}` : `${i.file}:${i.line}`
    return `${place}${file ? `  [${file.group}/${file.path.replace(/\.vue\.ts$/, '.vue')}]` : ''}\n  ${i.code}: ${i.message.replace(/\n/g, '\n  ')}`
  }))
}

const files = [...groups.values()].reduce((n, g) => n + g.length, 0)
console.log(`✓ docs check: ${blocks.length} blocks, ${files} files, ${groups.size} groups (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
