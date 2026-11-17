/**
 * The one-time setup code of a fresh production deploy: who opens /admin/setup
 * first must know it, so the first administrator is whoever can read the server log.
 *
 * 16 characters of a 32-letter alphabet (80 bits), shown as four groups of four:
 * short enough to type, far beyond guessing. The alphabet has no I, L, O or U, so a
 * code read off a log cannot be mistaken (an O typed for a 0 is accepted anyway).
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789' // 32 symbols
const GROUPS = 4
const GROUP_SIZE = 4

/**
 * A new random code, e.g. `K7QM-2XVD-R9TE-HC4Y`.
 *
 * @internal
 */
export function generateSetupCode(): string {
  // 256 is a multiple of 32, so a random byte maps onto the alphabet without bias.
  const bytes = crypto.getRandomValues(new Uint8Array(GROUPS * GROUP_SIZE))
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]!)
  const groups: string[] = []
  for (let i = 0; i < chars.length; i += GROUP_SIZE) groups.push(chars.slice(i, i + GROUP_SIZE).join(''))
  return groups.join('-')
}

/**
 * What a person typed or pasted, reduced to the code's own characters: case,
 * spaces and dashes do not matter (`k7qm 2xvd…` works), nor O for 0 or I/L for 1.
 *
 * @internal
 */
export function normalizeSetupCode(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 64).replace(/O/g, '0').replace(/[IL]/g, '1')
}
