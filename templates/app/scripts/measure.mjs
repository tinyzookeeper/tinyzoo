// What a build costs when it runs: the memory of its processes, how fast they answer, and what
// a visitor downloads. Sites are those of scripts/shots.mjs with the same prefix, kept and
// seeded (run shots.mjs with --keep first).
//
//   node templates/app/scripts/measure.mjs --pg <postgres url> --prefix tzshots_a_ --out <file.json>
//        --group <entry>=<template,template>[:model] [--group …] [--templates-dir <folder>] [--skip-downloads]
//
// Each group is one server process serving one site per look of its templates (`:model` when
// the rows name their content model: the one app). All groups run at the same time, as the
// processes of one machine would. For each process, its resident memory (ps):
//   - 30 s after it answers, before any request;
//   - after the warm-up: for every site, 50 rounds of its home page, each entry page, a missing
//     address, /sitemap.xml, /robots.txt and /admin/login;
//   - 60 s after the warm-up.
// Also the first answer of each site's home page after the start (the first of a design loads
// its code), and the median and 95th percentile of 200 home pages in a row per site. Then, per
// look, what a browser with an empty cache downloads for the home page, by kind (document,
// script, stylesheet, font; pictures left out).
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import { arg, entryPagesOf, firstSlug, freePortFrom, log, makeSites, repoRoot, sitesFor, sleep, startServer, writeDirectory } from './sites.mjs'

const pgUrl = arg('pg')
const prefix = arg('prefix')
const outFile = arg('out')
const templatesDir = resolve(arg('templates-dir', join(repoRoot, 'templates')))
const groups = process.argv.flatMap((a, i, all) => (a === '--group' ? [all[i + 1]] : [])).map((g) => {
  const [entry, rest] = g.split('=')
  const [list, flag] = rest.split(':')
  return { entry: resolve(entry), templates: list.split(','), model: flag === 'model' }
})
if (!pgUrl || !prefix || !outFile || !groups.length) {
  console.error('usage: measure.mjs --pg <url> --prefix <db prefix_> --out <file.json> --group <entry>=<a,b>[:model] …')
  process.exit(2)
}

const rssKb = (pid) => Number(spawnSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).stdout.trim()) || 0
const timed = async (url) => {
  const t = performance.now()
  const res = await fetch(url, { redirect: 'manual' })
  await res.arrayBuffer()
  return { ms: performance.now() - t, status: res.status }
}
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] }

const result = { started: new Date().toISOString(), node: process.version, groups: [] }
const running = []
try {
  let port = 4900
  for (const g of groups) {
    port = await freePortFrom(port)
    const dataDir = resolve(dirname(outFile), `${prefix}measure-${running.length}`)
    const rows = await makeSites({ pgUrl, prefix, dataDir, port, sites: await sitesFor(templatesDir, g.templates), model: g.model, keep: true })
    writeDirectory(join(dataDir, 'sites.json'), rows)
    const server = await startServer({ entry: g.entry, directoryFile: join(dataDir, 'sites.json'), port, logFile: join(dataDir, 'server.log') })
    log(`${g.templates.join(',')}: pid ${server.pid} on ${port}, answering after ${Math.round(server.readyMs)} ms`)
    running.push({ g, rows, server, out: { entry: g.entry, templates: g.templates, pid: server.pid, startMs: Math.round(server.readyMs), sites: {} } })
    port++
  }
  await sleep(30_000)
  for (const r of running) r.out.rssAfterStartKb = rssKb(r.server.pid)

  // The first answer of each site (a design's first site also loads the design's code).
  for (const r of running) {
    for (const row of r.rows) {
      const first = await timed(row._site.url)
      r.out.sites[row._site.slug] = { firstMs: Math.round(first.ms), firstStatus: first.status }
    }
  }

  log('warm-up')
  for (const r of running) {
    for (const row of r.rows) {
      const base = row._site.url
      const entries = []
      for (const page of entryPagesOf(templatesDir, row._site.template)) {
        const slug = await firstSlug(base, page.entity)
        if (slug) entries.push(`/${page.prefix}/${slug}`)
      }
      const paths = ['/', ...entries, '/tady-nic-neni', '/sitemap.xml', '/robots.txt', '/admin/login']
      for (let i = 0; i < 50; i++) for (const p of paths) await timed(base + p)
    }
  }
  for (const r of running) r.out.rssAfterWarmupKb = rssKb(r.server.pid)
  await sleep(60_000)
  for (const r of running) r.out.rssSettledKb = rssKb(r.server.pid)

  for (const r of running) {
    for (const row of r.rows) {
      const ms = []
      for (let i = 0; i < 200; i++) ms.push((await timed(row._site.url)).ms)
      Object.assign(r.out.sites[row._site.slug], { p50Ms: Math.round(pct(ms, 50) * 10) / 10, p95Ms: Math.round(pct(ms, 95) * 10) / 10 })
    }
  }

  if (arg('skip-downloads', false) !== true) {
    const { chromium } = createRequire(join(repoRoot, 'cloud', 'package.json'))('playwright')
    const browser = await chromium.launch()
    for (const r of running) {
      for (const row of r.rows) {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
        const page = await ctx.newPage()
        const got = []
        page.on('response', async (res) => {
          const kind = res.request().resourceType()
          if (kind === 'image' || !res.url().startsWith(row._site.url)) return
          try { const body = await res.body(); got.push({ kind, url: res.url(), bytes: body.length, gzip: gzipSync(body).length }) } catch { /* a redirect has no body */ }
        })
        await page.goto(row._site.url, { waitUntil: 'networkidle' })
        await page.evaluate(() => document.fonts.ready)
        await sleep(500)
        const by = {}
        for (const x of got) {
          by[x.kind] ??= { count: 0, bytes: 0, gzip: 0 }
          by[x.kind].count++; by[x.kind].bytes += x.bytes; by[x.kind].gzip += x.gzip
        }
        r.out.sites[row._site.slug].downloads = by
        r.out.sites[row._site.slug].fonts = got.filter((x) => x.kind === 'font').map((x) => x.url.split('/').pop())
        await ctx.close()
      }
    }
    await browser.close()
  }
}
finally {
  for (const r of running) { await r.server.stop(); log(`stopped ${r.server.pid}`) }
  result.groups = running.map((r) => r.out)
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, JSON.stringify(result, null, 2))
}
log(`→ ${outFile}`)
process.exit(0)
