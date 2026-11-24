import { describe, expect, it } from 'vitest'
import {
  archiveName, beginExportStep, compareVersions, completeExportStep, EXPORT_STEP_IDS, exportState, exportStepDone, failExportStep, importProblem,
  isArchiveName, newExport, normalizeExport, parseArchiveManifest, parseSiteFile, resumeExportSteps, toExportView, type SiteFile,
} from '../../cloud/shared/transfer'
import { cs } from '../../cloud/app/i18n/cs'
import { en } from '../../cloud/app/i18n/en'

// Moving a website out and in: the steps of an export, the file that travels in the archive,
// and what is checked before an archive is taken in.

const AT = '2026-11-23T10:00:00.000Z'

describe('the steps of an export', () => {
  it('are three, in order, all waiting at first', () => {
    const out = newExport(AT)
    expect(out.steps.map((s) => `${s.id}:${s.state}`)).toEqual(['readonly:pending', 'backup:pending', 'reopen:pending'])
    expect(out).toMatchObject({ requestedAt: AT, file: null, bytes: null, madeAt: null })
    expect(exportState(out.steps)).toBe('pending')
  })

  it('are written down as they run and finish', () => {
    let steps = beginExportStep(newExport(AT).steps, 'readonly', AT)
    expect(steps[0]).toMatchObject({ state: 'running', startedAt: AT, finishedAt: null })
    expect(exportState(steps)).toBe('running')
    steps = completeExportStep(steps, 'readonly', AT)
    expect(exportStepDone(steps, 'readonly')).toBe(true)
    expect(exportState(steps)).toBe('running')
    for (const id of ['backup', 'reopen'] as const) steps = completeExportStep(beginExportStep(steps, id, AT), id, AT)
    expect(exportState(steps)).toBe('done')
  })

  it('say where a failure was, and go on from there when asked again', () => {
    let steps = completeExportStep(beginExportStep(newExport(AT).steps, 'readonly', AT), 'readonly', AT)
    steps = failExportStep(beginExportStep(steps, 'backup', AT), 'backup', 'tools_missing', AT)
    expect(exportState(steps)).toBe('failed')
    expect(steps[1]).toMatchObject({ state: 'failed', message: 'tools_missing' })
    const again = resumeExportSteps(steps)
    expect(again.map((s) => s.state)).toEqual(['done', 'pending', 'pending'])
    expect(again[1]!.message).toBeNull()
  })

  it('are made whole when read back, and anything that is not an export is nothing', () => {
    expect(normalizeExport(null)).toBeNull()
    expect(normalizeExport({})).toBeNull()
    expect(normalizeExport('x')).toBeNull()
    const read = normalizeExport({ steps: [{ id: 'backup', state: 'done' }, { id: 'nonsense', state: 'done' }, { id: 'readonly', state: 'odd' }], file: '../../etc/passwd', bytes: 'many' })!
    expect(read.steps.map((s) => `${s.id}:${s.state}`)).toEqual(['readonly:pending', 'backup:done', 'reopen:pending'])
    expect(read.file).toBeNull()
    expect(read.bytes).toBeNull()
  })

  it('reach the browser without a path, and with the archive only when it is really there', () => {
    const done = { ...newExport(AT), steps: EXPORT_STEP_IDS.map((id) => ({ id, state: 'done' as const, startedAt: AT, finishedAt: AT, message: null })), file: 'tinyzoo-atelier-20261123-100000.tar', bytes: 123, madeAt: AT }
    expect(toExportView(done, true)).toEqual({ state: 'done', steps: EXPORT_STEP_IDS.map((id) => ({ id, state: 'done', message: null })), ready: true, bytes: 123, madeAt: AT })
    expect(toExportView(done, false)!.ready).toBe(false)
    expect(JSON.stringify(toExportView(done, true))).not.toContain('.tar')
    expect(toExportView(null, true)).toBeNull()
  })

  it('have words in both languages', () => {
    for (const id of EXPORT_STEP_IDS) {
      expect(cs).toHaveProperty([`move.step.${id}`])
      expect(en).toHaveProperty([`move.step.${id}`])
    }
  })
})

describe('the archive\'s name', () => {
  it('is tinyzoo-<address>-<time>.tar', () => {
    expect(archiveName('atelier-svetlo', new Date('2026-11-23T10:05:09.123Z'))).toBe('tinyzoo-atelier-svetlo-20261123-100509.tar')
    expect(isArchiveName('tinyzoo-atelier-svetlo-20261123-100509.tar')).toBe(true)
  })

  it('is never a path', () => {
    for (const bad of ['../tinyzoo-a-20261123-100509.tar', 'tinyzoo-a-20261123-100509.tar/x', '/etc/passwd', 'tinyzoo-A-20261123-100509.tar', 'tinyzoo-a-20261123-100509.tar.gz', 'x.tar', '']) expect(isArchiveName(bad), bad).toBe(false)
  })
})

const SITE: SiteFile = {
  format: 'tinyzoo-site', version: 1, exportedAt: AT, name: 'Ateliér Světlo', template: 'photographer', look: 'negativ', tinyzooVersion: '1.11.0',
  publicUrl: 'https://www.atelier.cz', hosts: ['www.atelier.cz', 'atelier-svetlo.localhost'], secret: 'a-site-secret-of-at-least-32-characters', statusToken: 'a-status-token-of-some-length',
  account: { issuer: 'https://tinyzoo.example', clientId: '99999999-8888-4777-8666-555555555555' }, plan: 'basic',
}

describe('site.json of an archive', () => {
  it('is read back as it was written', () => {
    expect(parseSiteFile(JSON.stringify(SITE))).toEqual(SITE)
  })

  it('never carries the client\'s secret, whatever was put in', () => {
    const read = parseSiteFile(JSON.stringify({ ...SITE, account: { ...SITE.account, clientSecret: 'leaked' }, databaseUrl: 'postgres://x', servicePassword: 'x' }))!
    expect(JSON.stringify(read)).not.toContain('leaked')
    expect(read).not.toHaveProperty('databaseUrl')
    expect(read).not.toHaveProperty('servicePassword')
  })

  it('is nothing when it is not one: another format, a short secret, no template, not JSON', () => {
    for (const bad of ['', 'not json', '{}', JSON.stringify({ ...SITE, format: 'other' }), JSON.stringify({ ...SITE, version: 2 }), JSON.stringify({ ...SITE, secret: 'short' }), JSON.stringify({ ...SITE, template: '../x' }), JSON.stringify({ ...SITE, template: '' }), JSON.stringify({ ...SITE, publicUrl: '' })]) {
      expect(parseSiteFile(bad), bad.slice(0, 40)).toBeNull()
    }
  })

  it('tolerates what is missing beside the essentials', () => {
    const read = parseSiteFile(JSON.stringify({ format: 'tinyzoo-site', version: 1, template: 'photographer', secret: SITE.secret, publicUrl: SITE.publicUrl }))!
    expect(read).toMatchObject({ name: '', look: null, hosts: [], account: null, statusToken: '', tinyzooVersion: '' })
  })
})

describe('an archive that is brought in', () => {
  const manifest = parseArchiveManifest(JSON.stringify({ format: 'tinyzoo-backup', version: 1, tinyzooVersion: '1.11.0', createdAt: AT, media: [{}, {}] }))

  it('has a manifest of `tinyzoo backup`', () => {
    expect(manifest).toEqual({ tinyzooVersion: '1.11.0', createdAt: AT, media: 2 })
    for (const bad of ['', '{}', JSON.stringify({ format: 'tinyzoo-export', version: 1, tinyzooVersion: '1.0.0' }), JSON.stringify({ format: 'tinyzoo-backup', version: 2, tinyzooVersion: '1.0.0' })]) expect(parseArchiveManifest(bad)).toBeNull()
  })

  it('is taken when the template is ready and the archive is not newer than the template\'s build', () => {
    expect(importProblem({ site: SITE, manifest, templateReady: true, buildVersion: '1.11.0' })).toBeNull()
    expect(importProblem({ site: SITE, manifest, templateReady: true, buildVersion: '1.12.0' })).toBeNull()
    expect(importProblem({ site: SITE, manifest, templateReady: true, buildVersion: '2.0.0' })).toBeNull()
  })

  it('is refused in plain words otherwise', () => {
    expect(importProblem({ site: null, manifest, templateReady: true, buildVersion: '1.11.0' })).toBe('archive')
    expect(importProblem({ site: SITE, manifest: null, templateReady: true, buildVersion: '1.11.0' })).toBe('archive')
    expect(importProblem({ site: SITE, manifest, templateReady: false, buildVersion: '' })).toBe('template')
    expect(importProblem({ site: SITE, manifest, templateReady: true, buildVersion: '1.10.9' })).toBe('newer')
    for (const code of ['archive', 'template', 'newer', 'large', 'upload', 'unavailable']) {
      expect(cs).toHaveProperty([`error.import.${code}`])
      expect(en).toHaveProperty([`error.import.${code}`])
    }
  })

  it('compares versions by their numbers, not as text', () => {
    expect(compareVersions('1.11.0', '1.9.3')).toBeGreaterThan(0)
    expect(compareVersions('1.9.3', '1.11.0')).toBeLessThan(0)
    expect(compareVersions('1.11.0', '1.11.0')).toBe(0)
    expect(compareVersions('1.11', '1.11.0')).toBe(0)
    expect(compareVersions('2.0.0-beta.1', '2.0.0')).toBe(0)
    expect(compareVersions('unknown', '1.0.0')).toBeLessThan(0)
  })
})
