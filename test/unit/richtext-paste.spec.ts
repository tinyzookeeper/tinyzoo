import { describe, expect, it } from 'vitest'
import { cleanPastedHtml } from '../../packages/cms/shared/richtext-paste'

// What Word puts on the clipboard (trimmed to the parts that matter): lists are paragraphs
// with the bullet as text in a hidden span; tables are tables; pictures point at the
// sender's own disk.
const bullet = (level: number, text: string, mark = '·', cls = 'MsoListParagraphCxSpMiddle') =>
  `<p class=${cls} style='margin-left:36.0pt;text-indent:-18.0pt;mso-list:l0 level${level} lfo1'><![if !supportLists]><span style='font-family:Symbol;mso-fareast-font-family:Symbol;mso-bidi-font-family:Symbol'><span style='mso-list:Ignore'>${mark}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>${text}<o:p></o:p></p>`
const numbered = (n: string, text: string) =>
  `<p class=MsoListParagraph style='text-indent:-18.0pt;mso-list:l1 level1 lfo2'><![if !supportLists]><span style='mso-list:Ignore'>${n}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp; </span></span><![endif]>${text}</p>`

describe('pasting from Word', () => {
  it('turns bullet paragraphs into a real list, with nested levels', () => {
    const word = `<html><body><!--StartFragment--><p>Přineste:</p>${bullet(1, 'chleba')}${bullet(1, 'sůl')}${bullet(2, 'hrubá', 'o')}${bullet(1, 'máslo')}<p>Díky</p><!--EndFragment--></body></html>`
    const { html } = cleanPastedHtml(word)
    expect(html).toContain('<p>Přineste:</p><ul><li>chleba</li><li>sůl<ul><li>hrubá</li></ul></li><li>máslo</li></ul><p>Díky</p>')
    // Nothing of Word's bullet character or its spacing is left in the text.
    expect(html).not.toContain('Symbol')
    expect(html).not.toContain('mso-list')
    expect(html).not.toContain('·')
  })

  it('turns numbered paragraphs into an ordered list', () => {
    const { html } = cleanPastedHtml(`${numbered('1.', 'upéct')}${numbered('2.', 'ochutnat')}`)
    expect(html).toBe('<ol><li>upéct</li><li>ochutnat</li></ol>')
    expect(cleanPastedHtml(`${numbered('a)', 'první')}${numbered('b)', 'druhá')}`).html).toBe('<ol><li>první</li><li>druhá</li></ol>')
  })

  it('keeps the text between items on its own and drops empty items', () => {
    const { html } = cleanPastedHtml(`${bullet(1, 'jedna')}<p>Mezitím odstavec</p>${bullet(1, 'dvě')}${bullet(1, '&nbsp;')}`)
    expect(html).toBe('<ul><li>jedna</li></ul><p>Mezitím odstavec</p><ul><li>dvě</li></ul>')
  })

  it('keeps bold and links inside list items', () => {
    const { html } = cleanPastedHtml(bullet(1, '<b>Tučně</b> a <a href="https://example.com">odkaz</a>'))
    expect(html).toBe('<ul><li><b>Tučně</b> a <a href="https://example.com">odkaz</a></li></ul>')
  })

  it('makes a table into readable lines: a paragraph per row, cells apart', () => {
    const table = `<table class=MsoTableGrid border=1><tr><td><p>Den</p></td><td><p><b>Otevřeno</b></p></td></tr><tr><td><p>Pondělí</p></td><td><p>8&ndash;16<o:p></o:p></p></td></tr><tr><td></td><td></td></tr></table>`
    const { html } = cleanPastedHtml(`<p>Hodiny</p>${table}<p>Konec</p>`)
    expect(html).toBe('<p>Hodiny</p><p>Den · Otevřeno</p><p>Pondělí · 8–16</p><p>Konec</p>')
    // Text with markup characters stays text.
    expect(cleanPastedHtml('<table><tr><td>a &lt; b</td><td>R&amp;D</td></tr></table>').html).toBe('<p>a &lt; b · R&amp;D</p>')
  })

  it('flattens a table inside a table', () => {
    const { html } = cleanPastedHtml('<table><tr><td>Venku</td><td><table><tr><td>uvnitř</td><td>dvě</td></tr></table></td></tr></table>')
    expect(html).toContain('Venku')
    expect(html).toContain('uvnitř · dvě')
    expect(html).not.toContain('<table')
  })

  it('drops images that cannot be shown and says how many', () => {
    const { html, droppedImages } = cleanPastedHtml(
      '<p>Text <img src="file:///C:/Users/ja/AppData/Local/Temp/msohtmlclip1/01/clip_image001.png" width=120> '
      + '<img src="data:image/png;base64,AAAA"> <img alt="bez zdroje"> <img src=cid:image002.png@01D9>'
      + '<img src="https://example.com/ok.png"> <img src="/api/cms/_media/img/x/y.png"></p>',
    )
    expect(droppedImages).toBe(4)
    expect(html).toBe('<p>Text    <img src="https://example.com/ok.png"> <img src="/api/cms/_media/img/x/y.png"></p>')
  })

  it('leaves ordinary HTML alone', () => {
    const plain = '<h2>Nadpis</h2><p>Text <strong>tučně</strong></p><ul><li>a</li><li>b</li></ul>'
    expect(cleanPastedHtml(plain)).toEqual({ html: plain, droppedImages: 0 })
    expect(cleanPastedHtml('')).toEqual({ html: '', droppedImages: 0 })
  })

  it('does not let markup through that was never in the text', () => {
    // Scripts and handlers are not touched here (the editor's schema leaves them out), and
    // text turned into a row is escaped, never read as markup.
    const { html } = cleanPastedHtml('<table><tr><td>&lt;img src=x onerror=alert(1)&gt;</td><td>b</td></tr></table>')
    expect(html).toBe('<p>&lt;img src=x onerror=alert(1)&gt; · b</p>')
  })
})
