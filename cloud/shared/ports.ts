// The local hosting driver gives every website a port of its own from a range.

export interface PortRange { from: number; to: number }

export const DEFAULT_PORT_RANGE: PortRange = { from: 4300, to: 4399 }

/** The range from settings (strings from the environment are fine); anything off falls back to the default. */
export function parsePortRange(from: unknown, to: unknown, fallback: PortRange = DEFAULT_PORT_RANGE): PortRange {
  const a = Number(from), b = Number(to)
  const ok = (n: number) => Number.isInteger(n) && n >= 1024 && n <= 65535
  if (!ok(a) || !ok(b) || a > b) return { ...fallback }
  return { from: a, to: b }
}

export const portsIn = (range: PortRange): number => range.to - range.from + 1

/**
 * The first port of the range that no website holds and nothing listens on. `taken` are the
 * ports of the other websites (running or not: a stopped site keeps its port, its address
 * contains it). `isFree` asks the machine. Null when the range is used up.
 */
export async function pickPort(range: PortRange, taken: Iterable<number>, isFree: (port: number) => boolean | Promise<boolean>): Promise<number | null> {
  const held = new Set(taken)
  for (let port = range.from; port <= range.to; port++) {
    if (held.has(port)) continue
    if (await isFree(port)) return port
  }
  return null
}
