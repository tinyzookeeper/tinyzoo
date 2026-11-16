// Nitro's auto-imports that server utilities loaded directly by a unit test call
// (the spec stubs them with vi.stubGlobal); the root type-check has no Nitro to know them.
declare function createError(input: { statusCode?: number; statusMessage?: string; message?: string; cause?: unknown; data?: unknown }): Error & { statusCode?: number }
declare function useRuntimeConfig(): any
