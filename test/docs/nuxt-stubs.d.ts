// What the doc snippets use without importing: Nuxt's auto-imports and the starter's own
// composables, reduced to the signatures the snippets rely on. Keep it small and true to
// Nuxt: the docs check exists to type-check the typed client and the config, not Nuxt.
// Add a stub here only when a snippet in docs/guide needs it.

interface Ref<T> { value: T }
interface ComputedRef<T> { readonly value: T }
type MaybeRefOrGetter<T> = T | Ref<T> | ComputedRef<T> | (() => T)

declare function ref<T>(value: T): Ref<T>
declare function computed<T>(getter: () => T): ComputedRef<T>

interface AsyncData<T> {
  data: Ref<T>
  error: Ref<{ statusCode?: number; message: string } | undefined>
  pending: Ref<boolean>
  refresh: () => Promise<void>
}
interface AsyncDataOptions<D> {
  /** What `data` holds before the request has answered (and when it failed). */
  default?: () => D
  watch?: unknown[]
  server?: boolean
  lazy?: boolean
}
declare function useAsyncData<T>(key: string | ComputedRef<string>, handler: () => Promise<T>, options?: AsyncDataOptions<undefined>): Promise<AsyncData<T | undefined>>
declare function useAsyncData<T, D>(key: string | ComputedRef<string>, handler: () => Promise<T>, options: AsyncDataOptions<D> & { default: () => D }): Promise<AsyncData<T | D>>

declare function useRequestURL(): URL
declare function useRoute(): { path: string; fullPath: string; params: Record<string, string | string[] | undefined>; query: Record<string, string | string[] | null | undefined> }
/** A page's route options (`<script setup>` of a file under app/pages). */
declare function definePageMeta(meta: { alias?: string | string[]; layout?: string | false; [key: string]: unknown }): void
declare function useHead(input: Record<string, unknown>): void
declare function createError(input: { statusCode?: number; statusMessage?: string; message?: string; fatal?: boolean }): Error
declare function navigateTo(to: string, options?: { redirectCode?: number }): Promise<void>

/** From tinyzoo's layer: title, description and sharing image from the `seo()` fields. */
declare function useCmsSeo(item: MaybeRefOrGetter<Record<string, any> | null | undefined>, options?: { siteName?: string; titleField?: string; descriptionField?: string; imageField?: string; fallback?: MaybeRefOrGetter<{ metaDescription?: string | null; ogImage?: { url?: string } | null } | null | undefined> }): void

/** From the starter (app/composables/useSite.ts): the visitor's language, from the address. */
declare function useSiteLocale(): ComputedRef<'cs' | 'en'>

// Nitro (server/** snippets)
declare function defineEventHandler<T>(handler: (event: { path: string }) => T | Promise<T>): (event: { path: string }) => Promise<T>
declare function getQuery(event: { path: string }): Record<string, string | undefined>
declare function readRawBody(event: { path: string }): Promise<string | undefined>
declare function getHeader(event: { path: string }, name: string): string | undefined

// <script setup> compiler macros
declare function defineProps<T>(): Readonly<T>
