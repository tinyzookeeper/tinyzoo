// What a website may use, by its plan. One plan today; a paid one later is another row here.
// The numbers travel to the site in its row of the site directory (`config.storage.maxSizeMb`,
// `config.storage.maxBytes`), and the site itself refuses what goes over them.

export interface PlanDef {
  id: string
  storage: {
    /** The largest single upload, in megabytes. */
    maxSizeMb: number
    /** Everything the site may store, in bytes. */
    maxBytes: number
  }
}

const MB = 1024 * 1024

export const PLANS: readonly PlanDef[] = [
  { id: 'basic', storage: { maxSizeMb: 20, maxBytes: 1024 * MB } },
]

export const DEFAULT_PLAN = 'basic'

/** A plan by its id; an unknown or missing id is the default plan. */
export function planById(id: string | null | undefined): PlanDef {
  return PLANS.find((p) => p.id === id) ?? PLANS.find((p) => p.id === DEFAULT_PLAN)!
}
