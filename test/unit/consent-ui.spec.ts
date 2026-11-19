import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeConsent } from '../../packages/cms/consent/core/cookie'
import { DEFAULT_TEXTS, resolveTexts } from '../../packages/cms/consent/core/texts'
import { createConsentRuntime, initialConsentState, type ConsentConfig, type ConsentEnv, type ConsentRuntime, type ConsentState } from '../../packages/cms/consent/app/runtime'
import type { CmsConsentApi } from '../../packages/cms/src/frontend'

// The composable uses Nuxt's auto-imports (stubbed below as globals); imported by a path the
// type check does not follow, as Nuxt's own typecheck covers the file.
const COMPOSABLE = '../../packages/cms/consent/composables/useConsent'
const { useConsent } = (await import(COMPOSABLE)) as { useConsent: () => CmsConsentApi }

// The cookie banner's headless part (useConsent(), on the runtime the app plugin makes) and the
// ready-made <CmsConsent> on it, with its slots. The pure parts are in consent.spec.ts. There is
// no DOM library in the repository: the component is compiled from its .vue file and mounted
// with a renderer that keeps its nodes in plain objects.

const ID = 'q8Kf2mZ0Ls9xWc4RbT7nYe'
const config: ConsentConfig = {
  version: 2, cookieDays: 365, locale: 'en', texts: DEFAULT_TEXTS.en.texts,
  categories: resolveTexts(null, ['analytics', 'marketing'], 'en', {
    services: { marketing: [{ name: 'Meta Pixel', provider: 'Meta Platforms Ireland Ltd.', purpose: 'Ads.', cookies: ['_fbp'], duration: '3 months' }] },
  }).categories,
}

function env(cookie = '', over: Partial<ConsentEnv> = {}) {
  const calls: any[] = []
  const e: ConsentEnv = {
    readCookie: () => cookie,
    writeCookie: () => {},
    loadConfig: async () => config,
    sendChoice: async (body) => {
      calls.push(body)
      const id = body.id ?? ID
      return { id, cookie: encodeConsent({ id, version: body.version, date: '2026-11-19', choice: body.choice }) }
    },
    secure: true,
    now: () => new Date('2026-11-19T12:00:00Z'),
    ...over,
  }
  return { e, calls }
}

/** What the consent plugin's app plugin does: one state per app, one runtime over it, as Nuxt's globals give them to useConsent(). */
function app(e: ConsentEnv) {
  const state = Vue.ref<ConsentState>(initialConsentState())
  const runtime = createConsentRuntime(state.value, e)
  vi.stubGlobal('useNuxtApp', () => ({ $cmsConsent: runtime }))
  vi.stubGlobal('useState', () => state)
  for (const k of ['computed', 'ref', 'reactive', 'watch', 'onMounted', 'nextTick', 'getCurrentScope', 'onScopeDispose'] as const) vi.stubGlobal(k, (Vue as any)[k])
  return { state, runtime }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useConsent(), without <CmsConsent> anywhere', () => {
  it('on the server, and until the cookie is read: only necessary, no banner, empty texts', () => {
    app(env().e)
    const c = useConsent()
    expect([c.ready.value, c.bannerVisible.value, c.granted('necessary'), c.granted('analytics')]).toEqual([false, false, true, false])
    expect(c.texts.value.title).toBe('')
    expect(c.categories.value).toEqual([])
  })
  it('shows the banner to a visitor without a choice, with the texts and the categories', async () => {
    const { runtime } = app(env().e)
    const c = useConsent()
    await runtime.start('en')
    expect(c.bannerVisible.value).toBe(true)
    expect(c.texts.value).toMatchObject({ title: 'Cookies on this website', acceptAll: 'Accept all', services: 'Services and cookies' })
    expect(c.categories.value.map((x) => [x.key, x.required, x.granted, x.services.map((s) => s.name)])).toEqual([
      ['necessary', true, true, ['Cookie consent']], ['analytics', false, false, []], ['marketing', false, false, ['Meta Pixel']],
    ])
  })
  it('does not show it to a visitor whose choice holds', async () => {
    const cookie = `tz_consent=${encodeConsent({ id: ID, version: 2, date: '2026-11-10', choice: { analytics: true, marketing: false } })}`
    const { runtime } = app(env(cookie).e)
    const c = useConsent()
    await runtime.start('en')
    expect([c.bannerVisible.value, c.decided.value]).toEqual([false, true])
    expect(c.categories.value.map((x) => x.granted)).toEqual([true, true, false])
  })
  it('accept all and reject all save, hide the banner and close the settings', async () => {
    const { e, calls } = env()
    const { runtime } = app(e)
    const c = useConsent()
    await runtime.start('en')
    c.open()
    await c.acceptAll()
    expect(calls).toEqual([{ id: null, choice: { analytics: true, marketing: true }, version: 2 }])
    expect([c.bannerVisible.value, c.settingsOpen.value, c.granted('marketing')]).toEqual([false, false, true])
    await c.rejectAll()
    expect(calls[1].choice).toEqual({ analytics: false, marketing: false })
  })
  it('the settings: switches from the choice, changed with set() or v-model on draft, saved with save()', async () => {
    const cookie = `tz_consent=${encodeConsent({ id: ID, version: 2, date: '2026-11-10', choice: { analytics: true, marketing: false } })}`
    const { e, calls } = env(cookie)
    const { runtime } = app(e)
    const c = useConsent()
    await runtime.start('en')
    c.open()
    expect(c.settingsOpen.value).toBe(true)
    expect({ ...c.draft }).toEqual({ necessary: true, analytics: true, marketing: false })
    c.set('marketing', true)
    c.set('necessary', false) // stays on
    c.draft.analytics = false // what v-model does
    expect({ ...c.draft }).toEqual({ necessary: true, analytics: false, marketing: true })
    // Nothing is saved until the visitor says so.
    expect(c.choice.value).toEqual({ analytics: true, marketing: false })
    await c.save()
    expect(calls).toEqual([{ id: ID, choice: { analytics: false, marketing: true }, version: 2 }])
    expect([c.settingsOpen.value, c.granted('marketing'), c.granted('analytics')]).toEqual([false, true, false])
  })
  it('closing the settings throws the switches away; opening them again starts from the choice', async () => {
    const { runtime } = app(env().e)
    const c = useConsent()
    await runtime.start('en')
    c.open()
    c.set('analytics', true)
    c.close()
    expect(c.choice.value).toBeNull()
    c.open()
    expect(c.draft.analytics).toBe(false)
  })
  it('save(choice) takes a record per category: one left out is a no', async () => {
    const { e, calls } = env()
    const { runtime } = app(e)
    const c = useConsent()
    await runtime.start('en')
    await c.save({ marketing: true })
    expect(calls[0].choice).toEqual({ analytics: false, marketing: true })
  })
  it('settings opened before the texts are in get their switches when they arrive', async () => {
    let release!: () => void
    const { runtime } = app(env('', { loadConfig: () => new Promise((r) => { release = () => r(config) }) }).e)
    const c = useConsent()
    const started = runtime.start('en')
    c.open()
    expect({ ...c.draft }).toEqual({})
    release()
    await started
    expect({ ...c.draft }).toEqual({ necessary: true, analytics: false, marketing: false })
  })
  it('saving and error: the server call, and why it failed; the choice holds in the browser all the same', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let fail = true
    let finish!: () => void
    const { e } = env('', {
      sendChoice: (body) => new Promise((resolve, reject) => {
        finish = () => (fail
          ? reject(Object.assign(new Error('fetch failed'), { data: { statusMessage: 'Too many choices; try again in a few minutes' } }))
          : resolve({ id: ID, cookie: encodeConsent({ id: ID, version: 2, date: '2026-11-19', choice: body.choice }) }))
      }),
    })
    const { runtime } = app(e)
    const c = useConsent()
    await runtime.start('en')
    const saving = c.acceptAll()
    expect(c.saving.value).toBe(true)
    finish()
    await saving
    expect([c.saving.value, c.error.value, c.granted('analytics')]).toEqual([false, 'Too many choices; try again in a few minutes', true])
    fail = false
    const again = c.rejectAll()
    expect(c.error.value).toBeNull()
    finish()
    await again
    expect(c.error.value).toBeNull()
  })
  it('the analytics tracker (strict) hears a choice made in a banner of the site\'s own', async () => {
    const { runtime } = app(env().e)
    const heard: any[] = []
    runtime.onChange((choice) => heard.push(choice))
    await runtime.start('en')
    await useConsent().acceptAll()
    expect(heard).toEqual([null, { analytics: true, marketing: true }])
  })
})

// ── <CmsConsent> ───────────────────────────────────────────────────────────────

interface Node { type?: string; text?: string; props: Record<string, any>; children: Node[]; parent: Node | null; open?: boolean }

/** The component's .vue file, compiled (template inlined), with Nuxt's auto-imports passed in. */
function loadCmsConsent(runtimeModule: Record<string, unknown>) {
  const file = join(import.meta.dirname, '../../packages/cms/consent/components/CmsConsent.vue')
  const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file })
  const script = compileScript(descriptor, { id: 'cms-consent-test', inlineTemplate: true })
  let code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false } }).outputText
  const modules: Record<string, Record<string, unknown>> = { vue: Vue as any, '../app/runtime': runtimeModule }
  code = code.replace(/^import \{([^}]*)\} from ['"]([^'"]+)['"];?$/gm, (_, names: string, from: string) => {
    if (!modules[from]) throw new Error(`CmsConsent imports ${from}`)
    return `const {${names.replace(/ as /g, ': ')}} = __modules[${JSON.stringify(from)}];`
  })
  code = code.replace(/^export default /m, 'return ')
  const autoImports = ['useConsent', 'useNuxtApp', 'useState', 'useRoute', 'useId', 'ref', 'computed', 'reactive', 'watch', 'onMounted', 'nextTick']
  // eslint-disable-next-line no-new-func
  return new Function('__modules', ...autoImports, code)(modules, ...autoImports.map((k) => (globalThis as any)[k])) as Vue.Component
}

function mountConsent(props: Record<string, unknown>, slots: Record<string, (p: any) => any> = {}) {
  const body: Node = { type: 'body', props: {}, children: [], parent: null }
  const root: Node = { type: 'div', props: {}, children: [], parent: null }
  const insert = (child: Node, parent: Node, anchor?: Node | null) => {
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
    const at = anchor ? parent.children.indexOf(anchor) : -1
    if (at >= 0) parent.children.splice(at, 0, child)
    else parent.children.push(child)
    child.parent = parent
  }
  const { createApp } = Vue.createRenderer<Node, Node>({
    createElement: (type) => ({
      type, props: {}, children: [], parent: null,
      ...(type === 'dialog' ? { open: false, showModal(this: Node) { this.open = true }, close(this: Node) { this.open = false } } : {}),
      focus() {},
    } as Node),
    createText: (text) => ({ text, props: {}, children: [], parent: null }),
    createComment: () => ({ text: '', props: {}, children: [], parent: null }),
    setText: (n, text) => { n.text = text },
    setElementText: (n, text) => { n.children = text ? [{ text, props: {}, children: [], parent: n }] : [] },
    insert,
    remove: (n) => { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null },
    parentNode: (n) => n.parent,
    nextSibling: (n) => (n.parent ? n.parent.children[n.parent.children.indexOf(n) + 1] ?? null : null),
    patchProp: (n, key, _prev, next) => { n.props[key] = next },
    querySelector: () => body,
  })
  const vm = createApp({ render: () => Vue.h(CmsConsent, props, slots) })
  vm.mount(root)
  return { body, root }
}
const rawText = (n: Node): string => (n.text ?? '') + n.children.map(rawText).join(n.type ? ' ' : '')
const textOf = (n: Node): string => rawText(n).replace(/\s+/g, ' ').trim()
const all = (n: Node, ok: (x: Node) => boolean): Node[] => [...(ok(n) ? [n] : []), ...n.children.flatMap((c) => all(c, ok))]
const byClass = (n: Node, cls: string) => all(n, (x) => String(x.props.class ?? '').split(/\s+/).includes(cls))
const tick = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

let CmsConsent: Vue.Component
let runtime: ConsentRuntime
describe('<CmsConsent>', () => {
  beforeEach(async () => {
    ;({ runtime } = app(env().e))
    vi.stubGlobal('useConsent', useConsent)
    vi.stubGlobal('useRoute', () => ({ path: '/' }))
    vi.stubGlobal('useId', () => 'c1')
    vi.stubGlobal('document', { activeElement: null })
    vi.stubGlobal('HTMLElement', class {})
    CmsConsent = loadCmsConsent({ initialConsentState })
    await runtime.start('en')
  })

  it('draws the banner and its dialog, styled, in the body', async () => {
    const { body } = mountConsent({})
    await tick()
    const [banner] = byClass(body, 'cms-consent')
    expect(banner!.props.class).toBe('cms-consent cms-consent-styled')
    expect(textOf(banner!)).toContain('Cookies on this website')
    expect(byClass(banner!, 'cms-consent__btn').map(textOf)).toEqual(['Reject all', 'Accept all', 'Settings'])
    const [dialog] = byClass(body, 'cms-consent__dialog')
    expect(byClass(dialog!, 'cms-consent__service-name').map(textOf)).toEqual(['Cookie consent', 'Meta Pixel'])
    byClass(banner!, 'cms-consent__btn')[2]!.props.onClick()
    await tick()
    expect(dialog!.open).toBe(true)
  })
  it('unstyled: the same markup and classes, without the class the default styles hang on', async () => {
    const { body } = mountConsent({ unstyled: true })
    await tick()
    expect(byClass(body, 'cms-consent')[0]!.props.class).toBe('cms-consent')
    expect(byClass(body, 'cms-consent-styled')).toEqual([])
    expect(byClass(body, 'cms-consent__btn')).not.toEqual([])
  })
  it('the banner slot replaces its content and gets the whole API, unwrapped', async () => {
    let seen: any
    const { body } = mountConsent({}, {
      banner: (p: any) => { seen = p; return Vue.h('p', { class: 'mine' }, `${p.texts.title} / ${p.bannerVisible}`) },
    })
    await tick()
    const [banner] = byClass(body, 'cms-consent')
    expect(textOf(banner!)).toBe('Cookies on this website / true')
    expect(byClass(banner!, 'cms-consent__btn')).toEqual([])
    // Named by the title, as the heading that labelled it is gone.
    expect(banner!.props['aria-label']).toBe('Cookies on this website')
    expect(Object.keys(seen).sort()).toEqual([
      'acceptAll', 'bannerVisible', 'categories', 'choice', 'close', 'decided', 'draft', 'error', 'granted', 'onChange', 'open',
      'ready', 'rejectAll', 'save', 'saving', 'set', 'settingsOpen', 'texts',
    ])
    expect(seen.categories).toHaveLength(3)
    await seen.acceptAll()
    expect(runtime.state.choice).toEqual({ analytics: true, marketing: true })
  })
  it('actions, category and settings-actions replace their parts only', async () => {
    const { body } = mountConsent({}, {
      'actions': (p: any) => Vue.h('button', { class: 'cms-consent__btn', onClick: () => p.rejectAll() }, 'No thanks'),
      'category': (p: any) => Vue.h('label', `${p.category.label}: ${p.draft[p.category.key]}`),
      'settings-actions': (p: any) => Vue.h('button', { onClick: () => p.save() }, 'Done'),
    })
    await tick()
    const [banner] = byClass(body, 'cms-consent')
    expect(textOf(banner!)).toContain('Cookies on this website')
    expect(byClass(banner!, 'cms-consent__btn').map(textOf)).toEqual(['No thanks'])
    const [dialog] = byClass(body, 'cms-consent__dialog')
    expect(byClass(dialog!, 'cms-consent__cat').map(textOf)).toEqual(['Necessary: true', 'Statistics: false', 'Marketing: false'])
    expect(textOf(dialog!)).toContain('Cookie settings')
    expect(textOf(dialog!)).toContain('Done')
  })
  it('settings replaces the dialog\'s content; the dialog stays modal', async () => {
    const { body } = mountConsent({}, { settings: (p: any) => Vue.h('div', p.categories.map((c: any) => c.key).join(',')) })
    await tick()
    const [dialog] = byClass(body, 'cms-consent__dialog')
    expect(textOf(dialog!)).toBe('necessary,analytics,marketing')
    expect(dialog!.props['aria-label']).toBe('Cookie settings')
    runtime.open()
    await tick()
    expect(dialog!.open).toBe(true)
  })
  it('the default slot replaces everything: nothing of its own is drawn', async () => {
    const { body, root } = mountConsent({}, { default: (p: any) => Vue.h('aside', p.bannerVisible ? p.texts.acceptAll : '') })
    await tick()
    expect(body.children).toEqual([])
    expect(textOf(root)).toBe('Accept all')
  })
  it('draws nothing in the admin', async () => {
    vi.stubGlobal('useRoute', () => ({ path: '/admin/posts' }))
    CmsConsent = loadCmsConsent({ initialConsentState })
    const { body } = mountConsent({})
    await tick()
    expect(byClass(body, 'cms-consent')).toEqual([])
    expect(byClass(body, 'cms-consent__dialog')).toEqual([])
  })
})
