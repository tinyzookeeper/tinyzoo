// The editor in the preview: what the page loaded through the content API (since 2f). A block may draw
// entries of a collection or a global's values next to its own fields; to find them in the page, the page
// keeps, while the tools are on, each answer of the content API it got: the collection or global (from the
// address), and each entry's id and values (shared/builder-sources.ts reads them).
//
// One place sees every such answer in the browser: the window's `fetch`, which Nuxt's `$fetch` and
// `useFetch` call too, as a site's own plain request does. While the tools are on it is wrapped: a GET of
// the content API asks for the editor's preview (`?preview`, so what is typed in an entry beside the page
// shows in it) and its answer is kept. What the server drew before the tools were on is loaded again once
// (`refreshNuxtData`, which the preview does on every change anyway), through the wrapped `fetch`. Nothing
// of this runs on the live site or with the tools off: this module is loaded only on `cms:builder:on`.
//
// Which block loads what: a block's drawing depends on the data it loaded (Nuxt keeps an answer of
// `useFetch`/`useAsyncData` in a ref), so the refs its drawing reads, through computed values and its
// child components, say which answers it uses, also when it shows nothing of them now (no notice valid
// today). An answer is told by its content: the same JSON as an answer the page kept.
import type { ComponentInternalInstance, VNode } from 'vue'
import { cmsContentEntries, cmsContentRequest, cmsContentWithPreview, type CmsSourceRecord } from '../../shared/builder-sources'
import { cmsBuilderHold } from './state'

/** Everything the page loaded of each collection and global, by its name. */
export const cmsSourceRecords = new Map<string, CmsSourceRecord>()
/** Bumped on every answer kept: what was found from the records is found again. */
export const cmsSourceChanges = { version: 0, listeners: new Set<() => void>() }

/** Each answer's JSON and what it was of, for the data a block's drawing reads (the last ones only). */
const answers = new Map<string, string>()
const ANSWERS_MOST = 300
let app: { _asyncData?: Record<string, { data?: { value: unknown; dep?: object } } | undefined> } | null = null
let installed = false

function keep(request: { entity: string; global: boolean }, body: unknown) {
  const record = cmsSourceRecords.get(request.entity) ?? { entity: request.entity, global: request.global, entries: new Map() }
  for (const item of cmsContentEntries(body)) {
    const id = typeof item.id === 'string' && item.id ? item.id : request.global ? request.entity : null
    if (id) record.entries.set(id, item)
  }
  cmsSourceRecords.set(request.entity, record)
  try {
    const json = JSON.stringify(body)
    answers.delete(json)
    answers.set(json, request.entity)
    if (answers.size > ANSWERS_MOST) answers.delete(answers.keys().next().value!)
  }
  catch { /* not JSON after all */ }
  cmsSourceChanges.version++
  for (const listener of cmsSourceChanges.listeners) listener()
}

/** Start keeping what the page loads through the content API, and load once what the server drew. */
export function recordCmsContent(nuxtApp: unknown) {
  if (installed || typeof window === 'undefined') return
  installed = true
  app = nuxtApp as typeof app
  const original = window.fetch
  const origin = location.origin
  window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
    const request = method === 'GET' ? cmsContentRequest(url, origin) : null
    if (!request) return original.call(this, input, init)
    const asked = cmsContentWithPreview(url, origin)
    const next = typeof input === 'string' ? asked : input instanceof URL ? new URL(asked, origin) : new Request(new URL(asked, origin), input)
    return original.call(this, next, init).then((res) => {
      if (res.ok) res.clone().json().then((body) => keep(request, body), () => {})
      return res
    })
  } as typeof window.fetch
  void cmsBuilderHold.refresh()
}

// ── which block loads what ──

interface Link { dep: Dep; nextDep?: Link }
interface Dep { computed?: { deps?: Link } }
interface Sub { deps?: Link }

/** Every reactive source a subscriber (a component's drawing, a watcher, a computed value) reads, through computed values. */
function depsOf(sub: Sub | undefined, into: Set<object>, depth: number) {
  if (!sub || depth > 16) return
  for (let link = sub.deps; link; link = link.nextDep) {
    const dep = link.dep
    if (!dep || into.has(dep)) continue
    into.add(dep)
    if (dep.computed) depsOf(dep.computed, into, depth + 1)
  }
}

function depsOfInstance(instance: ComponentInternalInstance, into: Set<object>, budget: { left: number }) {
  if (--budget.left < 0) return
  depsOf((instance as unknown as { effect?: Sub }).effect, into, 0)
  for (const effect of ((instance as unknown as { scope?: { effects?: Sub[] } }).scope?.effects ?? [])) depsOf(effect, into, 0)
  depsOfVNode(instance.subTree, into, budget)
}

function depsOfVNode(vnode: VNode | null | undefined, into: Set<object>, budget: { left: number }) {
  if (!vnode || --budget.left < 0) return
  if (vnode.component) {
    depsOfInstance(vnode.component, into, budget)
    return
  }
  const suspense = (vnode as unknown as { suspense?: { activeBranch?: VNode | null } }).suspense
  if (suspense) depsOfVNode(suspense.activeBranch, into, budget)
  if (Array.isArray(vnode.children)) for (const child of vnode.children) if (child && typeof child === 'object') depsOfVNode(child as VNode, into, budget)
}

/**
 * The collections and globals a block's component loads (through `useFetch`, `useAsyncData` or `$fetch` in
 * them): the answers kept in Nuxt's data that its drawing, or a child component's, reads. Uses what Vue and
 * Nuxt keep inside; when that is not there, nothing is known (what the block shows is still found).
 */
export function cmsSourcesLoadedBy(instance: ComponentInternalInstance | undefined): string[] {
  const data = app?._asyncData
  if (!instance || !data) return []
  const deps = new Set<object>()
  try {
    depsOfInstance(instance, deps, { left: 4000 })
  }
  catch {
    return []
  }
  const out = new Set<string>()
  for (const entry of Object.values(data)) {
    const ref = entry?.data
    if (!ref?.dep || !deps.has(ref.dep)) continue
    let json: string | undefined
    try {
      json = JSON.stringify(ref.value)
    }
    catch { continue }
    const entity = json === undefined ? undefined : answers.get(json)
    if (entity) out.add(entity)
  }
  return [...out]
}
