import { describe, expect, it } from 'vitest'
import { csvCell, neutraliseCell } from '../../packages/cms/server/utils/cmsCsv'

describe('CSV cells for Excel', () => {
  it.each([
    '=HYPERLINK("http://evil","x")', '=1+1', '@SUM(A1)', '+SUM(A1:A9)', '-2+3+cmd|\' /C calc\'!A0', '+cmd|\' /C calc\'!A0',
    '\t=1+1', '\r=1+1', '-HYPERLINK("x")', '+1+HYPERLINK("x")',
  ])('neutralises the formula %j', (cell) => {
    expect(neutraliseCell(cell)).toBe(`'${cell}`)
  })

  it.each(['+420 777 123 456', '+420777123456', '+1 (555) 123-4567', '-5', '-12.50', '+49 30 123456', '+420 777/123.456'])('leaves the phone number or amount %j as it is', (cell) => {
    expect(neutraliseCell(cell)).toBe(cell)
  })

  it.each(['Jana', 'a = b', 'e-mail', 'x@y.cz', '100 %', ''])('leaves ordinary text %j alone', (cell) => {
    expect(neutraliseCell(cell)).toBe(cell)
  })

  it('quotes cells with separators, quotes and line breaks, after neutralising', () => {
    expect(csvCell('a, b')).toBe('"a, b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=1;2')).toBe('"\'=1;2"')
    expect(csvCell('+420 777 123 456')).toBe('+420 777 123 456')
  })
})
