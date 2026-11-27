// The editor in the preview (experimental, NUXT_CMS_BUILDER=on): the history of the changes to a
// page's blocks while the editor is open, for undo and redo. Pure: it keeps whole values (the
// field's list of blocks before and after a step) and says what to show after an undo; the admin's
// bridge (useCmsBuilder) applies them. Nothing here is reactive.
//
// Every change is one step, but typing: changes with the same `group` (a field of a block) that come
// within `pause` ms of each other are one step, so an undo takes back a word or a sentence, not a key.

/** What a step changed: the block to select after it is undone or redone, else the block around it. */
export interface HistoryFocus {
  id: string | null
  /** The ids of the blocks around it, nearest last: one of them is selected when the block itself is gone. */
  around?: string[]
}

export interface HistoryStep<T> {
  id: number
  before: T
  after: T
  group: string | null
  at: number
  focus: HistoryFocus
}

export interface HistoryOptions {
  /** At most this many steps are kept (the oldest go first). */
  max?: number
  /** Typing in one field within this many ms of the last change is the same step. */
  pause?: number
}

export interface BuilderHistory<T> {
  /** Keep a change. Returns the step it went into (a new one, or the open step of the same group). */
  record: (before: T, after: T, options?: { group?: string | null; focus?: HistoryFocus; now?: number }) => number
  /** The step to take back (its `before` is the value to apply), or `null` when there is none. */
  undo: () => HistoryStep<T> | null
  /** The step to do again (its `after` is the value to apply), or `null`. */
  redo: () => HistoryStep<T> | null
  /** The step an undo takes back now (its id), or `null`. */
  top: () => number | null
  /** End the open typing step: the next change starts a new one. */
  seal: () => void
  clear: () => void
  /** Since 2g: forget the steps `gone` says (an entry handed to its own editor): they can be neither undone nor done again. */
  drop: (gone: (step: HistoryStep<T>) => boolean) => void
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly size: number
}

export const HISTORY_MAX = 50
export const HISTORY_PAUSE = 1000

export function createBuilderHistory<T>(options: HistoryOptions = {}): BuilderHistory<T> {
  const max = Math.max(1, options.max ?? HISTORY_MAX)
  const pause = options.pause ?? HISTORY_PAUSE
  let done: HistoryStep<T>[] = []
  let undone: HistoryStep<T>[] = []
  let next = 1
  let open = true
  return {
    record(before, after, { group = null, focus = { id: null }, now = Date.now() } = {}) {
      const last = done[done.length - 1]
      if (open && last && group !== null && last.group === group && !undone.length && now - last.at <= pause) {
        last.after = after
        last.at = now
        return last.id
      }
      const step: HistoryStep<T> = { id: next++, before, after, group, at: now, focus }
      done.push(step)
      if (done.length > max) done = done.slice(done.length - max)
      undone = []
      open = true
      return step.id
    },
    undo() {
      const step = done.pop()
      if (!step) return null
      undone.push(step)
      open = false
      return step
    },
    redo() {
      const step = undone.pop()
      if (!step) return null
      done.push(step)
      open = false
      return step
    },
    top: () => done[done.length - 1]?.id ?? null,
    seal() {
      open = false
    },
    clear() {
      done = []
      undone = []
    },
    drop(gone) {
      done = done.filter((s) => !gone(s))
      undone = undone.filter((s) => !gone(s))
      open = false
    },
    get canUndo() {
      return done.length > 0
    },
    get canRedo() {
      return undone.length > 0
    },
    get size() {
      return done.length
    },
  }
}
