// Compare two folders of pictures taken by scripts/shots.mjs, picture by picture.
//
//   node templates/app/scripts/compare-shots.mjs <before folder> <after folder> [--approved <file.json>]
//
// A pair passes when the widths are equal, the heights differ by at most 2 px, at most 0.1 % of
// the pixels differ (a pixel differs when a channel differs by more than 24 of 255) and no
// 32 × 32 tile has more than 10 % of its pixels differing. A failing pair gets <name>.diff.png
// beside the after picture: the differing pixels in red over a faded copy of it. A failure
// listed in the approved file (`{ "<name>.png": "why" }`) is reported with its reason and does
// not fail the run.
import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { arg, repoRoot } from './sites.mjs'

const sharp = createRequire(join(repoRoot, 'packages/cms/package.json'))('sharp')
const [before, after] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--approved')
if (!before || !after) {
  console.error('usage: compare-shots.mjs <before> <after> [--approved <file.json>]')
  process.exit(2)
}
const approvedFile = arg('approved', null)
const approved = approvedFile && existsSync(approvedFile) ? JSON.parse(readFileSync(approvedFile, 'utf8')) : {}
const CHANNEL = 24
const TILE = 32

const raw = (f) => sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

async function compare(name) {
  const [a, b] = await Promise.all([raw(join(before, name)), raw(join(after, name))])
  const { width: w, height: ha } = a.info
  const hb = b.info.height
  if (w !== b.info.width) return { name, ok: false, why: `width ${w} → ${b.info.width}` }
  if (Math.abs(ha - hb) > 2) return { name, ok: false, why: `the page's length changed: ${ha} → ${hb} px` }
  const h = Math.min(ha, hb)
  const tiles = new Map()
  const mask = Buffer.alloc(w * h)
  let differing = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (Math.abs(a.data[i] - b.data[i]) > CHANNEL || Math.abs(a.data[i + 1] - b.data[i + 1]) > CHANNEL || Math.abs(a.data[i + 2] - b.data[i + 2]) > CHANNEL) {
        differing++
        mask[y * w + x] = 1
        const key = `${Math.floor(x / TILE)},${Math.floor(y / TILE)}`
        tiles.set(key, (tiles.get(key) ?? 0) + 1)
      }
    }
  }
  const share = differing / (w * h)
  const worstTile = Math.max(0, ...tiles.values()) / (TILE * TILE)
  const ok = share <= 0.001 && worstTile <= 0.1
  if (!ok) {
    // The after picture faded, the differing pixels in red.
    const out = Buffer.alloc(w * h * 4)
    for (let p = 0; p < w * h; p++) {
      const i = p * 4
      if (mask[p]) { out[i] = 230; out[i + 1] = 0; out[i + 2] = 0 }
      else for (let c = 0; c < 3; c++) out[i + c] = 255 - Math.round((255 - b.data[i + c]) * 0.25)
      out[i + 3] = 255
    }
    await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toFile(join(after, name.replace(/\.png$/, '.diff.png')))
  }
  return { name, ok, differing, share, worstTile, why: ok ? '' : `${differing} pixels differ (${(share * 100).toFixed(3)} %), worst tile ${(worstTile * 100).toFixed(1)} %` }
}

const names = readdirSync(before).filter((f) => f.endsWith('.png') && !f.endsWith('.diff.png')).sort()
const missing = names.filter((f) => !existsSync(join(after, f)))
const extra = readdirSync(after).filter((f) => f.endsWith('.png') && !f.endsWith('.diff.png') && !names.includes(f))
let failed = 0
let identical = 0
let passed = 0
let approvedCount = 0
for (const name of names.filter((f) => !missing.includes(f))) {
  const r = await compare(name)
  if (r.ok && r.differing === 0) identical++
  if (r.ok && r.differing) console.log(`= ${name}: ${r.differing} pixels differ (${(r.share * 100).toFixed(3)} %), within the tolerance`)
  if (r.ok) { passed++; continue }
  if (approved[name]) { approvedCount++; console.log(`~ ${name}: ${r.why}; approved: ${approved[name]}`) }
  else { failed++; console.log(`✗ ${name}: ${r.why}`) }
}
for (const f of missing) { failed++; console.log(`✗ ${f}: missing after`) }
for (const f of extra) console.log(`? ${f}: only after`)
console.log(`${names.length} pictures compared: ${identical} identical, ${passed} within the tolerance (identical included), ${approvedCount} approved differences, ${failed} failing`)
process.exit(failed ? 1 : 0)
