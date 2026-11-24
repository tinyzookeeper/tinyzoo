import type { ModelOp } from '../../src/model-doc'
import { cmsModelProblem, type CmsModelData, type CmsModelProblemInfo } from '../utils/cmsModel'

/** One saved version of the content types, as `GET /api/cms/_model/history` lists it. */
export interface CmsModelHistoryEntry {
  version: number
  at: string
  by: { id: string; name: string } | null
  ops: ModelOp[]
}

/** What `POST /api/cms/_model` answers when the change worked. */
export interface CmsModelChangeResult {
  version: number
  doc: CmsModelData['doc']
  notes: { code: string; message: string; op: number; type: string; field?: string }[]
  statements: number
}

/**
 * The site's own content types for the structure editor (`GET /api/cms/_model`) and the one way to
 * change them. `change` sends the operations against the version on screen; a refusal comes back as
 * words (`problem`), never thrown, so the dialog that asked can say it where the person is looking.
 */
export function useCmsModel() {
  const { t } = useCmsI18n()
  const toast = useToast()
  const request = useFetch<CmsModelData>('/api/cms/_model', { key: 'cms-model' })

  /** Reads the model, the menu (a new type is in it at once) and the history again. */
  const refreshAll = () => Promise.all([request.refresh(), refreshNuxtData(['cms-graph', 'cms-menu', 'cms-model-history'])])

  async function change(ops: ModelOp[], options: { quiet?: boolean } = {}): Promise<{ ok: true; result: CmsModelChangeResult } | { ok: false; problem: CmsModelProblemInfo }> {
    const base = request.data.value?.version
    try {
      const result = await $fetch<CmsModelChangeResult>('/api/cms/_model', { method: 'POST', body: { baseVersion: base ?? 0, ops } })
      await refreshAll()
      return { ok: true, result }
    }
    catch (err: any) {
      const problem = cmsModelProblem(err, t as any, ops)
      // Somebody else changed the types first: what is shown is read again, so the next try is made against it.
      if (problem.kind === 'stale') {
        await refreshAll()
        if (!options.quiet) toast.add({ title: problem.text, icon: 'i-lucide-triangle-alert', color: 'warning' })
      }
      return { ok: false, problem }
    }
  }

  return {
    data: request.data,
    error: request.error,
    status: request.status,
    refresh: request.refresh,
    /** Resolves once the model is loaded (`await model.ready`). */
    ready: request as unknown as Promise<unknown>,
    change,
  }
}

/** The saved versions, newest first. Loaded on the client, after the page is shown. */
export function useCmsModelHistory() {
  return useFetch<CmsModelHistoryEntry[]>('/api/cms/_model/history', { key: 'cms-model-history', server: false, lazy: true })
}

/** The names of types and fields in the admin's language. */
export function useCmsModelLabels() {
  const { tl } = useCmsI18n()
  type Labelled = { name?: string; key?: string; label?: unknown; labelSingular?: unknown | null }
  const fallback = (x: Labelled) => x.name ?? x.key ?? ''
  return {
    typeLabel: (x: Labelled) => tl(x.label as any, fallback(x)),
    singularLabel: (x: Labelled) => tl((x.labelSingular ?? x.label) as any, fallback(x)),
    fieldLabel: (x: Labelled) => tl(x.label as any, fallback(x)),
  }
}
