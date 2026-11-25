import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL_LIMITS } from 'tinyzoo'
import { planById, PLANS } from '../../cloud/shared/plans'
import { customTypesEnv, customTypesSetting, localSiteRow, sharedDirectoryText, sharedSiteRow } from '../../cloud/shared/sharedHosting'
import { APPS, appById } from '../../cloud/shared/templates'

// A site's own content types in the cloud (experimental): off unless CLOUD_CUSTOM_TYPES=on.
// Off, the rows the drivers write and the environment they start an app with are as before.

const ID = '7f3a2c1e-0b4d-4e6f-8a9b-0c1d2e3f4a5b'
const ENV = {
  NUXT_APP_SECRET: 'an-app-secret-of-at-least-32-characters',
  NUXT_CMS_AUTH_SETUP_TOKEN: 'setup-code',
  NUXT_CMS_STATUS_TOKEN: 'status-token',
  NUXT_CMS_MIGRATIONS_ON_START: 'true',
  NUXT_CMS_MAIL_TRANSPORT: 'file',
  NUXT_CMS_AUTH_ACCOUNT_ISSUER: 'https://tinyzoo.example',
  NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID: '99999999-8888-4777-8666-555555555555',
  NUXT_CMS_AUTH_ACCOUNT_CLIENT_SECRET: 'a-client-secret',
}
const ACCOUNT = { issuer: 'https://tinyzoo.example', clientId: '99999999-8888-4777-8666-555555555555', clientSecret: 'a-client-secret' }
const shared = { siteId: ID, slug: 'atelier-svetlo', port: 4400, databaseUrl: 'postgres://tzs_x:pw@localhost:5434/tzs_x', env: ENV, siteDir: `/data/templates/sites/${ID}`, limits: planById('basic').storage, model: 'photographer' }
const local = { siteId: ID, publicUrl: 'http://atelier-svetlo.localhost:4301', databaseUrl: 'postgres://cms:cms@localhost:5434/tzc_atelier_svetlo', env: ENV, siteDir: '/data/sites/atelier-svetlo', model: 'photographer' }

// The two rows exactly as the drivers wrote them before the setting existed, keys in their order.
const BEFORE = {
  shared: {
    id: ID, hosts: ['atelier-svetlo.localhost'], publicUrl: 'http://atelier-svetlo.localhost:4400', databaseUrl: 'postgres://tzs_x:pw@localhost:5434/tzs_x', secret: ENV.NUXT_APP_SECRET, model: 'photographer',
    config: {
      auth: { setupToken: 'setup-code', account: ACCOUNT },
      status: { token: 'status-token' },
      storage: { driver: 'local', local: { dir: `/data/templates/sites/${ID}/uploads` }, maxSizeMb: 20, maxBytes: 1073741824 },
      mail: { file: { dir: `/data/templates/sites/${ID}/mail` } },
    },
  },
  local: {
    id: ID, hosts: ['atelier-svetlo.localhost'], alsoHosts: ['127.0.0.1'], publicUrl: 'http://atelier-svetlo.localhost:4301', databaseUrl: 'postgres://cms:cms@localhost:5434/tzc_atelier_svetlo', secret: ENV.NUXT_APP_SECRET, model: 'photographer',
    config: {
      auth: { setupToken: 'setup-code', account: ACCOUNT },
      status: { token: 'status-token' },
      storage: { driver: 'local', local: { dir: '/data/sites/atelier-svetlo/uploads' } },
      mail: { file: { dir: '/data/sites/atelier-svetlo/mail' } },
    },
  },
} as const

const templatesApp = appById('templates')!
const basicApp = appById('basic')!

describe('the plan\'s limits for a site\'s own content types', () => {
  it('Basic has tinyzoo\'s defaults: 12 types, 30 fields each', () => {
    expect(planById('basic').customTypes).toEqual({ types: 12, fields: 30 })
    expect(planById('basic').customTypes).toEqual({ types: DEFAULT_MODEL_LIMITS.types, fields: DEFAULT_MODEL_LIMITS.fields })
    for (const plan of PLANS) expect(plan.customTypes.types >= 0 && plan.customTypes.fields >= 0).toBe(true)
  })
})

describe('CLOUD_CUSTOM_TYPES', () => {
  it('is on with `on` only', () => {
    expect(customTypesSetting('on')).toBe(true)
    expect(customTypesSetting(' on ')).toBe(true)
    for (const off of [undefined, null, '', 'off', 'true', '1', 'ON', 'yes']) expect(customTypesSetting(off), String(off)).toBe(false)
  })
})

describe('a site\'s row with the setting off', () => {
  it('is byte for byte the row the drivers wrote before', () => {
    const before = sharedDirectoryText([BEFORE.shared as any, BEFORE.local as any])
    expect(sharedDirectoryText([sharedSiteRow(shared), localSiteRow(local)])).toBe(before)
    expect(sharedDirectoryText([sharedSiteRow({ ...shared, customTypes: null }), localSiteRow({ ...local, customTypes: null })])).toBe(before)
    expect(sharedSiteRow(shared).config).not.toHaveProperty('customTypes')
    expect(localSiteRow(local).config).not.toHaveProperty('customTypes')
  })
})

describe('a site\'s row with the setting on', () => {
  const limits = planById('basic').customTypes

  it('gets the plan\'s limits as config.customTypes, last, and nothing else changes', () => {
    for (const [row, before] of [[sharedSiteRow({ ...shared, customTypes: limits }), BEFORE.shared], [localSiteRow({ ...local, customTypes: limits }), BEFORE.local]] as const) {
      expect(row.config.customTypes).toEqual({ types: 12, fields: 30 })
      expect(Object.keys(row.config).at(-1)).toBe('customTypes')
      const { customTypes, ...rest } = row.config
      expect(JSON.stringify({ ...row, config: rest })).toBe(JSON.stringify(before))
    }
  })

  it('refuses limits tinyzoo would not read', () => {
    for (const bad of [{ types: -1, fields: 30 }, { types: 12, fields: 201 }, { types: 1.5, fields: 30 }, { types: Number.NaN, fields: 30 }, { types: '12' as any, fields: 30 }]) {
      expect(() => sharedSiteRow({ ...shared, customTypes: bad }), JSON.stringify(bad)).toThrow(/whole numbers from 0 to 200/)
      expect(() => localSiteRow({ ...local, customTypes: bad }), JSON.stringify(bad)).toThrow(/whole numbers from 0 to 200/)
    }
    expect(sharedSiteRow({ ...shared, customTypes: { types: 0, fields: 200 } }).config.customTypes).toEqual({ types: 0, fields: 200 })
  })
})

describe('the environment a driver starts an app with', () => {
  it('has nothing of the feature with the setting off, for either app', () => {
    for (const app of APPS) expect(customTypesEnv(app, false), app.id).toEqual({})
  })

  it('switches it on for the one app only: the Basic website\'s app is started without it', () => {
    expect(templatesApp.models).toBe(true)
    expect(customTypesEnv(templatesApp, true)).toEqual({ NUXT_CMS_CUSTOM_TYPES: 'on' })
    expect(basicApp.models).toBe(false)
    expect(customTypesEnv(basicApp, true)).toEqual({})
  })
})
