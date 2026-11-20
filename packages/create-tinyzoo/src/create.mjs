// `pnpm create tinyzoo`: asks a few questions, then makes the site with tinyzoo's own init
// (cli/init.mjs of the `tinyzoo` package, bundled here at pack time: scripts/bundle.mjs), so
// this and `tinyzoo init <folder> <the same flags>` make the same site.
//
// Every question has a flag, and with `--yes` (or without a terminal) nothing is asked:
//
//   pnpm create tinyzoo my-site --languages cs,en --presets news,search --no-demo --yes
//
// Ctrl-C at a question ends the run and writes nothing. A failure while making the site
// removes what it made; a failed install keeps the finished folder and says what to run.
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const USAGE = `Make a new website with tinyzoo.

  pnpm create tinyzoo [folder] [options]
  npm create tinyzoo@latest [folder] -- [options]

Without options you are asked. Every question has an option, and with --yes (or without a
terminal) nothing is asked: the defaults are used for what is not given.

  --languages cs,en      the content languages; the first one is the default (default: cs,en)
  --presets a,b | none   the parts of the site: news, forms, redirects, search, analytics (default: all)
  --demo / --no-demo     fill it with demo content (a small bakery, in Czech and English)
  --install / --no-install    install the dependencies right away (default: asked; no with --yes)
  --package-manager pnpm      pnpm, npm, yarn or bun (default: the one you ran this with)
  -y, --yes              ask nothing
  -h, --help

The same options, except the installing and --yes (init never asks), work with \`tinyzoo init <folder>\`.`

/** The init code, the starter and the version to pin: bundled in the published package, from the repository when run there. */
export async function loadTemplate() {
  const bundled = join(root, 'bundle')
  const cms = join(root, '..', 'cms')
  const from = existsSync(join(bundled, 'init.mjs'))
    ? { init: join(bundled, 'init.mjs'), starterDir: join(bundled, 'starter'), version: JSON.parse(readFileSync(join(bundled, 'tinyzoo.json'), 'utf8')).version }
    : existsSync(join(cms, 'cli', 'init.mjs'))
      ? { init: join(cms, 'cli', 'init.mjs'), starterDir: join(cms, 'starter'), version: JSON.parse(readFileSync(join(cms, 'package.json'), 'utf8')).version }
      : null
  if (!from) throw new Error('create-tinyzoo is missing its starter (the package was not packed with its bundle). Reinstall it, or use `tinyzoo init`.')
  return { init: await import(pathToFileURL(from.init).href), starterDir: from.starterDir, version: from.version }
}

function runCommand(command, args, cwd) {
  return new Promise((done) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('error', () => done(false))
    child.on('exit', (code) => done(code === 0))
  })
}

/**
 * @param {string[]} argv  `process.argv.slice(2)`
 * @param {object} [deps]  for tests: `ui` (the prompts: @clack/prompts), `interactive`, `cwd`, `env`, `log`, `error`, `loadTemplate`, `run(command, args, cwd)`
 * @returns {Promise<number>} the exit code
 */
export async function main(argv, deps = {}) {
  const { ui, cwd = process.cwd(), env = process.env, log = console.log, error = console.error } = deps
  const template = await (deps.loadTemplate ?? loadTemplate)()
  const { init } = template
  const run = deps.run ?? runCommand

  let args
  try { args = init.parseInitArgs(argv, { create: true }) }
  catch (err) {
    if (!(err instanceof init.InitError)) throw err
    error(`✗ ${err.message}\n\n${USAGE}`)
    return 1
  }
  if (args.help) { log(USAGE); return 0 }

  const interactive = !args.yes && (deps.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY))
  if (interactive && !ui) throw new Error('create-tinyzoo: no prompts to ask with')
  const cancelled = () => { ui.cancel('Cancelled. Nothing was written.'); return 0 }

  try {
    if (interactive) ui.intro('create-tinyzoo')

    // The package manager: the one that ran us, else asked (when there is a terminal).
    const agent = /^(pnpm|npm|yarn|bun)\//.exec(env.npm_config_user_agent ?? '')?.[1]
    let packageManager = args.packageManager ?? agent
    if (!packageManager) {
      if (interactive) {
        packageManager = await ui.select({ message: 'Which package manager?', options: init.PACKAGE_MANAGERS.map((value) => ({ value, label: value })), initialValue: 'pnpm' })
        if (ui.isCancel(packageManager)) return cancelled()
      }
      else packageManager = 'pnpm'
    }

    // ── the questions ──
    let folder = args.folder
    if (!folder) {
      if (!interactive) throw new init.InitError(`Give the site a folder: create-tinyzoo <folder>\n\n${USAGE}`)
      folder = await ui.text({
        message: 'Where should the site go?',
        placeholder: 'my-site',
        defaultValue: 'my-site',
        validate: (value) => {
          const target = resolve(cwd, (value || 'my-site').trim())
          if (existsSync(target) && readdirSync(target).length) return `${target} exists and is not empty`
          return undefined
        },
      })
      if (ui.isCancel(folder)) return cancelled()
      folder = String(folder || 'my-site').trim()
    }

    let languages = args.languages
    if (!languages && interactive) {
      const answer = await ui.text({
        message: 'Content languages (codes, the first one is the default)',
        placeholder: 'cs,en',
        initialValue: init.DEFAULT_LANGUAGES.join(','),
        validate: (value) => { try { init.parseLanguages(value ?? ''); return undefined } catch (err) { return err.message } },
      })
      if (ui.isCancel(answer)) return cancelled()
      languages = init.parseLanguages(answer)
    }

    let presets = args.presets
    if (!presets && interactive) {
      const answer = await ui.multiselect({
        message: 'Which parts should the site have? (pages, menus and settings are always in)',
        options: init.PRESETS.map((p) => ({ value: p.name, label: p.label, hint: p.hint })),
        initialValues: init.PRESET_NAMES,
        required: false,
      })
      if (ui.isCancel(answer)) return cancelled()
      presets = init.PRESET_NAMES.filter((n) => answer.includes(n))
    }

    let demo = args.demo
    const first = (languages ?? init.DEFAULT_LANGUAGES)[0]
    if (demo === undefined && interactive) {
      if (init.DEMO_LANGUAGES.includes(first)) {
        const answer = await ui.confirm({ message: 'Fill it with demo content? (a small bakery, in Czech and English)', initialValue: true })
        if (ui.isCancel(answer)) return cancelled()
        demo = answer
      }
      else ui.log.info(`No demo content: it is written in Czech and English, and the first language is ${first}.`)
    }

    const choices = init.resolveOptions({ languages, presets, demo })

    let install = args.install
    if (install === undefined) {
      install = false
      if (interactive) {
        const answer = await ui.confirm({ message: `Install the dependencies with ${packageManager} now?`, initialValue: true })
        if (ui.isCancel(answer)) return cancelled()
        install = answer
      }
    }

    // ── the site ──
    const { dest, regenerate } = init.scaffold({ ...choices, dest: resolve(cwd, folder), starterDir: template.starterDir, version: template.version, packageManager })

    let installed = false
    let generated = false
    if (install) {
      if (interactive) ui.log.step(`Installing with ${packageManager}…`)
      installed = await run(packageManager, ['install'], dest)
      if (!installed) (interactive ? ui.log.warn : error)(`The install did not finish. The site is made; run \`${packageManager} install\` in ${folder} yourself.`)
      else if (regenerate.schema || regenerate.client) {
        // The starter's own generated files do not fit these choices: write the right ones.
        generated = true
        for (const script of [regenerate.schema && 'db:generate', regenerate.client && 'cms:client'].filter(Boolean)) {
          if (!(await run(packageManager, ['run', script], dest))) {
            generated = false
            ;(interactive ? ui.log.warn : error)(`\`${packageManager} run ${script}\` did not finish; run it in ${folder} yourself.`)
            break
          }
        }
      }
    }

    const text = `✓ created ${dest}\n${init.nextSteps({ folder, packageManager, demo: choices.demo, regenerate, installed, generated })}`
    if (interactive) ui.outro(text)
    else log(text)
    return 0
  }
  catch (err) {
    if (!(err instanceof init.InitError)) {
      error(`✗ ${err instanceof Error ? err.message : err}`)
      return 1
    }
    error(`✗ ${err.message}`)
    return 1
  }
}
