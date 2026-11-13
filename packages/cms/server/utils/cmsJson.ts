import { stableJson as stable } from '../../shared/json'

/** Key-order-insensitive JSON (see shared/json.ts). */
export function stableJson(value: unknown): string {
  return stable(value)
}
