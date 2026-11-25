import { readFile } from 'node:fs/promises'
import { describeModelOps, diffModelFile, MODEL_FILE_ASSET, MODEL_FILE_NAME, mergeModelFileAdditions, parseModelFile, writeModelFile, type ModelFile } from 'tinyzoo'
import { scrubError } from './cmsScrub'

/**
 * A single-site app's own model file (docs/model-file-plan.md, section 9; experimental).
 *
 * The build carries the app's `cms.model.json` as a server asset (module.ts). When the one site is
 * counted (NUXT_CMS_CUSTOM_TYPES=on), it takes the file in once per process, before it serves
 * (`cmsSiteReady` waits for this, after the migrations and before the site's types are read):
 *
 * 1. With NUXT_CMS_MODEL_FILE=follow: what the file has and the database lacks is added, through
 *    the structure function, as the server's own work. Nothing is removed or changed. A refusal is
 *    one error line, and the site serves what its database has.
 * 2. The file is registered as the code `app` (NUXT_CMS_MODEL_CODE names it otherwise), so a change
 *    that takes away what the app's pages read is refused. A file that does not fit is registered
 *    all the same (the code runs either way) and the log says what it lacks.
 *
 * NUXT_CMS_MODEL_FILE=off ignores the file. A file that does not read is one error line and is
 * ignored. Nothing here stops the site. Multi-tenant mode never comes here: one build serves many
 * sites (plugins/cms-model.ts says so at start).
 */

const taken = cmsProcessWide<{ ready: Promise<void> | null }>({ ready: null }, 'the app\'s model file is taken in once per process, by whichever instance of the one site asks first')

/** How many times `follow` reads the site's model again when another instance changed it in between. */
const FOLLOW_ROUNDS = 4

/** Resolves once the app's model file is taken in (at once when there is none). Never fails. */
export function cmsAppModelFileReady(): Promise<void> {
  if (cmsIsMultiTenant()) return Promise.resolve()
  taken.ready ??= takeIn().catch((err) => {
    console.error('[cms] the app\'s model file could not be taken in', scrubError(err))
  })
  return taken.ready
}

/** `NUXT_CMS_MODEL_FILE`: unset registers the file, `follow` also adds what it has, `off` ignores it. */
function setting(): 'register' | 'follow' | 'off' {
  const raw = String(process.env.NUXT_CMS_MODEL_FILE ?? '').trim().toLowerCase()
  if (raw === 'follow' || raw === 'off') return raw
  if (raw) console.warn(`[cms] NUXT_CMS_MODEL_FILE is "${raw.slice(0, 40)}": it may be follow or off (or unset). The model file is registered, nothing is added`)
  return 'register'
}

/** The text of the app's model file: the one the build carries, or (tests) the file CMS_TEST_MODEL_FILE names. Null when there is none. */
async function fileText(): Promise<string | null> {
  const testFile = process.env.CMS_TEST_MODEL_FILE
  if (testFile) return readFile(testFile, 'utf8').catch(() => null)
  const raw = await useStorage(`assets:${MODEL_FILE_ASSET}`).getItemRaw(MODEL_FILE_NAME).catch(() => null)
  if (raw == null) return null
  return typeof raw === 'string' ? raw : new TextDecoder().decode(raw as Uint8Array)
}

async function takeIn(): Promise<void> {
  const how = setting()
  if (how === 'off') return
  const text = await fileText()
  if (text === null) return
  let file: ModelFile
  try {
    file = parseModelFile(JSON.parse(text))
  }
  catch (err) {
    console.error(`[cms] the app's model file (${MODEL_FILE_NAME}) cannot be read, so it is ignored: ${(err as Error)?.message ?? String(err)}`)
    return
  }
  // The feature is off for the site (its design has a type with the custom prefix): readCustomPart says so.
  if (!cmsCustomTypes().on) return
  if (how === 'follow') await follow(file)
  await register(file)
}

/** Add what the file has and the site lacks. Two instances starting together take turns on the structure's lock; the later one finds nothing left to add. */
async function follow(file: ModelFile): Promise<void> {
  for (let round = 1; ; round++) {
    const current = await cmsModelFileAt(null)
    const { ops, problems } = diffModelFile(current, mergeModelFileAdditions(current, file))
    if (problems.length) {
      console.error(`[cms] what the app's model file adds cannot be made: ${problems.map((p) => p.message).join('; ')}`)
      return
    }
    if (!ops.length) return
    try {
      const done = await cmsChangeModelBeforeLoad({ baseVersion: current.version, ops, via: 'file' }, { announce: true })
      console.info(`[cms] added from the app's model file (version ${done.version}): ${describeModelOps(ops).join('; ')}`)
      return
    }
    catch (err) {
      const data = (err as any)?.data
      if ((data?.code === 'stale-version' || data?.code === 'busy') && round < FOLLOW_ROUNDS) continue
      const what = typeof data?.op === 'number' && ops[data.op] ? ` (${describeModelOps([ops[data.op]!]).join('; ')})` : ''
      console.error(`[cms] what the app's model file adds was refused, so the site serves the content types its database has${what}: ${data?.message ?? scrubError(err).message}`)
      return
    }
  }
}

/** Register the file as the app's code. The same file registered before is left as it is. */
async function register(file: ModelFile): Promise<void> {
  const name = String(process.env.NUXT_CMS_MODEL_CODE ?? '').trim() || 'app'
  try {
    const stored = await cmsModelCodeFile(name)
    if (stored && stored.source === 'app' && sameFile(stored.file, file)) {
      // Nothing is written, so a restart adds no line to the audit log. What the site lacks is said again.
      const fit = await cmsModelFit(file)
      if (!fit.fits) console.warn(`[cms] the code "${name}" (the app's model file) reads what the site lacks: ${fit.breaks.map((b) => b.message).join('; ')}`)
      return
    }
    await cmsRegisterCode(null, { name, file, source: 'app', force: true })
  }
  catch (err) {
    const data = (err as any)?.data
    console.error(`[cms] the app's model file could not be registered as "${name.slice(0, 40)}": ${data?.message ?? scrubError(err).message}`)
  }
}

function sameFile(stored: unknown, file: ModelFile): boolean {
  try { return writeModelFile(parseModelFile(stored)) === writeModelFile(file) }
  catch { return false }
}
