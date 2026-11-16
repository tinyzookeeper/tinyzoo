import { describe, expect, it } from 'vitest'
import { defineForm, f, generateSetupCode, normalizeSetupCode, buildRegistry } from '../../packages/cms/src/index'
import { pgEnv, safeKey, settingsFrom } from '../../packages/cms/cli/backup'

describe('setup code', () => {
  it('is four groups of four from an alphabet without look-alikes', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateSetupCode()
      expect(code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/)
      expect(code).not.toMatch(/[ILOU]/)
    }
  })

  it('does not repeat and uses the whole alphabet', () => {
    const seen = new Set<string>()
    const chars = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const code = generateSetupCode()
      seen.add(code)
      for (const c of code.replaceAll('-', '')) chars.add(c)
    }
    expect(seen.size).toBe(2000)
    expect(chars.size).toBe(32)
  })

  it('reads what people type: case, spaces, dashes, O for 0, I/L for 1', () => {
    expect(normalizeSetupCode('k7qm-2xvd-r9te-hc4y')).toBe('K7QM2XVDR9TEHC4Y')
    expect(normalizeSetupCode(' K7QM 2XVD  R9TE\nHC4Y ')).toBe('K7QM2XVDR9TEHC4Y')
    expect(normalizeSetupCode('OIL0')).toBe('0110')
    expect(normalizeSetupCode(undefined)).toBe('')
    expect(normalizeSetupCode(12345)).toBe('')
    expect(normalizeSetupCode('x'.repeat(500))).toHaveLength(64)
  })
})

describe('defineForm retentionDays', () => {
  const fields = { email: f.text({ required: true, format: 'email' }), message: f.text({ required: true }) }

  it('is kept on the form and shown in the admin graph; default is to keep', () => {
    const kept = defineForm('keptForm', { label: 'Kept', fields })
    const limited = defineForm('limitedForm', { label: 'Limited', fields, retentionDays: 90 })
    const reg = buildRegistry({ kept, limited })
    expect((limited as any).form.retentionDays).toBe(90)
    expect((kept as any).form.retentionDays).toBeNull()
    // The forms plugin (registered by itself here: the deprecated defineForm) adds the note to the graph.
    expect(reg.graph.find((g) => g.name === 'limitedForm')!.notices).toEqual([{ icon: 'i-lucide-clock', key: 'plugins.forms.retention', params: { count: 90 } }])
    expect(reg.graph.find((g) => g.name === 'keptForm')!.notices).toEqual([])
  })

  it('rejects a number of days that cannot be meant', () => {
    for (const bad of [0, -5, 1.5, Number.NaN]) {
      expect(() => defineForm('badForm', { label: 'Bad', fields, retentionDays: bad })).toThrow(/retentionDays/)
    }
  })
})

describe('backup settings', () => {
  it('reads the database and storage the way the server does: environment, then nuxt config, then defaults', () => {
    const cms = { databaseUrl: 'postgres://cfg/db', storage: { driver: 's3', local: { dir: 'cfg-uploads' }, s3: { endpoint: 'https://cfg', bucket: 'cfg-bucket', accessKeyId: 'k', secretAccessKey: 's' } } }
    const fromConfig = settingsFrom('/site', {}, cms)
    expect(fromConfig.databaseUrl).toBe('postgres://cfg/db')
    expect(fromConfig.storage).toMatchObject({ driver: 's3', localDir: '/site/cfg-uploads', s3: { bucket: 'cfg-bucket', region: 'us-east-1' } })

    const env = { DATABASE_URL: 'postgres://env/db', NUXT_CMS_DATABASE_URL: 'postgres://nuxt-env/db', NUXT_CMS_STORAGE_DRIVER: 'r2', NUXT_CMS_STORAGE_S3_BUCKET: 'env-bucket', NUXT_CMS_STORAGE_LOCAL_DIR: '/data/up' }
    const fromEnv = settingsFrom('/site', env, cms)
    expect(fromEnv.databaseUrl).toBe('postgres://nuxt-env/db')
    expect(fromEnv.storage).toMatchObject({ driver: 'r2', localDir: '/data/up', s3: { bucket: 'env-bucket', endpoint: 'https://cfg', region: 'auto' } })

    expect(settingsFrom('/site', {}, {}).storage).toMatchObject({ driver: 'local', localDir: '/site/.cms-uploads' })
  })

  it('hands the connection to pg_dump through the environment, not the command line', () => {
    const env = pgEnv('postgres://us%40er:p%40ss%2Fword@db.example.com:6543/my_db?sslmode=no-verify')
    expect(env).toMatchObject({ PGHOST: 'db.example.com', PGPORT: '6543', PGUSER: 'us@er', PGPASSWORD: 'p@ss/word', PGDATABASE: 'my_db', PGSSLMODE: 'require' })
    expect(() => pgEnv('not a url')).toThrow(/valid connection string/)
  })

  it('ignores PG* variables of the shell, so the dump cannot go to another database', () => {
    process.env.PGDATABASE_LEAK = 'x'
    process.env.PGHOST = 'elsewhere'
    try {
      const env = pgEnv('postgres://u:p@localhost/mine')
      expect(env.PGHOST).toBe('localhost')
      expect(env.PGDATABASE_LEAK).toBeUndefined()
    }
    finally {
      delete process.env.PGDATABASE_LEAK
      delete process.env.PGHOST
    }
  })

  it('only accepts storage keys that stay inside the folder', () => {
    for (const ok of ['2026/11/3f2a.png', 'a.txt', '_w/320/2026/x.png.webp']) expect(safeKey(ok), ok).toBe(true)
    for (const bad of ['', '/etc/passwd', '../x', 'a/../../x', 'a//b', './a', 'a\\b', 'a\0b']) expect(safeKey(bad), bad).toBe(false)
  })
})
