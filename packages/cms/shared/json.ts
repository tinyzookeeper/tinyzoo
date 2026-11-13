/**
 * JSON for comparing values: object keys sorted, so the same value compares equal
 * however it was built — Postgres stores jsonb with its keys reordered, and the
 * editor builds them in its own order. Shared by the admin and the server.
 */
export function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v)
}
