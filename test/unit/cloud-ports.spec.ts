import { describe, expect, it } from 'vitest'
import { DEFAULT_PORT_RANGE, parsePortRange, pickPort, portsIn } from '../../cloud/shared/ports'

// The local hosting driver gives every website a port of its own from a range.
describe('the range of ports', () => {
  it('is 4300–4399 unless told otherwise', () => {
    expect(DEFAULT_PORT_RANGE).toEqual({ from: 4300, to: 4399 })
    expect(portsIn(DEFAULT_PORT_RANGE)).toBe(100)
    expect(parsePortRange('', '')).toEqual(DEFAULT_PORT_RANGE)
    expect(parsePortRange(undefined, undefined)).toEqual(DEFAULT_PORT_RANGE)
  })

  it('reads numbers and strings from the environment', () => {
    expect(parsePortRange('5000', '5009')).toEqual({ from: 5000, to: 5009 })
    expect(parsePortRange(5000, 5000)).toEqual({ from: 5000, to: 5000 })
  })

  it('falls back when the settings make no sense', () => {
    for (const [from, to] of [[5010, 5000], ['abc', 5000], [80, 90], [70000, 70010], [4300.5, 4310], [null, 4310]] as const) {
      expect(parsePortRange(from, to), `${from}–${to}`).toEqual(DEFAULT_PORT_RANGE)
    }
    // The fallback is a copy: changing the answer does not change the default.
    parsePortRange('x', 'y').from = 1
    expect(DEFAULT_PORT_RANGE.from).toBe(4300)
  })
})

describe('picking a port', () => {
  const range = { from: 4300, to: 4304 }

  it('takes the first one nothing uses', async () => {
    expect(await pickPort(range, [], () => true)).toBe(4300)
  })

  it('skips the ports other sites hold, running or not', async () => {
    const asked: number[] = []
    const port = await pickPort(range, [4300, 4301], (p) => { asked.push(p); return true })
    expect(port).toBe(4302)
    // A held port is not even tried: a stopped site keeps its port (its address contains it).
    expect(asked).toEqual([4302])
  })

  it('skips the ports something else listens on', async () => {
    const busy = new Set([4300, 4302])
    expect(await pickPort(range, [4301], (p) => !busy.has(p))).toBe(4303)
  })

  it('asks the machine with a promise too', async () => {
    expect(await pickPort(range, [], async (p) => p === 4304)).toBe(4304)
  })

  it('says when the range is used up', async () => {
    expect(await pickPort(range, [4300, 4301, 4302, 4303, 4304], () => true)).toBeNull()
    expect(await pickPort(range, [], () => false)).toBeNull()
  })

  it('never leaves the range', async () => {
    for (let n = 0; n < 5; n++) {
      const held = Array.from({ length: n }, (_, i) => 4300 + i)
      const port = await pickPort(range, held, () => true)
      expect(port).toBeGreaterThanOrEqual(range.from)
      expect(port).toBeLessThanOrEqual(range.to)
    }
  })
})
