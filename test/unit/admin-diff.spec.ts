import { describe, expect, it } from 'vitest'
import { richTextToPlain, wordDiff } from '../../packages/cms/app/utils/cmsDiff'

describe('admin diff helpers', () => {
  it('marks the words that changed between two texts', () => {
    const parts = wordDiff('Zahrada se otevírá v sobotu', 'Zahrada se otevírá v neděli')
    expect(parts.filter((p) => p.kind !== 'same').map((p) => [p.kind, p.text])).toEqual([['removed', 'sobotu'], ['added', 'neděli']])
    expect(parts.filter((p) => p.kind !== 'removed').map((p) => p.text).join('')).toBe('Zahrada se otevírá v neděli')
  })

  it('reads rich text as plain paragraphs', () => {
    expect(richTextToPlain({ type: 'doc', content: [
      { type: 'heading', content: [{ type: 'text', text: 'Nadpis' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Text ' }, { type: 'text', text: 'tučně', marks: [{ type: 'bold' }] }] },
    ] })).toBe('Nadpis\nText tučně')
  })

  it('gives up on huge texts instead of stalling', () => {
    const a = Array.from({ length: 1000 }, (_, i) => `a${i}`).join(' ')
    const b = Array.from({ length: 1000 }, (_, i) => `b${i}`).join(' ')
    expect(wordDiff(a, b)).toEqual([{ text: a, kind: 'removed' }, { text: b, kind: 'added' }])
  })
})
