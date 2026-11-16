// `pnpm typecheck`: the types of this site's own files, templates included (vue-tsc 3).
//
// The block components take their props from the generated client (app/lib/cms-content.ts),
// so renaming a field in cms.config.ts and running `pnpm cms:client` makes every template
// that still reads the old name fail here, instead of showing nothing on a live page.
//
// The CMS's own admin components (the tinyzoo layer) are part of the same TypeScript project;
// they are tinyzoo's to keep right, so only findings in this site's files are reported.
import { spawnSync } from 'node:child_process'

const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' })

const prepared = run('pnpm', ['exec', 'nuxt', 'prepare'])
if (prepared.status !== 0) {
  process.stderr.write(prepared.stdout + prepared.stderr)
  process.exit(prepared.status ?? 1)
}

// An error starts at the file name; its explanation continues on indented lines.
const own = (file) => !file.startsWith('.') && !file.includes('node_modules') && !/^[a-zA-Z]:|^\//.test(file)
const findings = []
for (const project of ['.nuxt/tsconfig.app.json', '.nuxt/tsconfig.server.json']) {
  const res = run('pnpm', ['exec', 'vue-tsc', '--noEmit', '--pretty', 'false', '-p', project])
  let keep = false
  for (const line of `${res.stdout}${res.stderr}`.split('\n')) {
    const m = /^(.+?)\(\d+,\d+\): error TS\d+/.exec(line)
    if (m) keep = own(m[1])
    else if (/^\S/.test(line)) keep = false
    if (keep) findings.push(line)
  }
}

if (findings.length) {
  console.error(findings.join('\n'))
  console.error(`\n✗ ${findings.filter((l) => /: error TS/.test(l)).length} type error(s) in this site's files`)
  process.exit(1)
}
console.log('✓ types ok (this site\'s own files, templates included)')
