// Downloading and copying the brand's files on the design-system page: the SVG as it is, a PNG
// drawn from it in the browser, or either one on the clipboard. Browser only (canvas, clipboard).

/** The long edge of a PNG, in pixels: sharp enough for slides and print, small enough to send. */
export const PNG_LONG_EDGE = 2048

const svgCache = new Map<string, Promise<string>>()

/** A file's SVG text, fetched once per address. */
export function fetchSvg(url: string): Promise<string> {
  let text = svgCache.get(url)
  if (!text) {
    text = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`)
      return r.text()
    })
    text.catch(() => svgCache.delete(url))
    svgCache.set(url, text)
  }
  return text
}

/** The SVG drawn onto a transparent canvas, its long edge `longEdge` pixels. */
export async function svgToPng(svg: string, longEdge = PNG_LONG_EDGE): Promise<Blob> {
  const box = /<svg\b[^>]*\bviewBox="([^"]+)"/.exec(svg)?.[1]?.trim().split(/[\s,]+/).map(Number)
  const [w, h] = box?.length === 4 && box[2]! > 0 && box[3]! > 0 ? [box[2]!, box[3]!] : [1, 1]
  const scale = longEdge / Math.max(w, h)
  const width = Math.round(w * scale)
  const height = Math.round(h * scale)
  // An explicit size on the root: Firefox will not draw an SVG image without one.
  const sized = svg.replace(/<svg\b([^>]*)>/, (_, attrs: string) => `<svg${attrs.replace(/\s(?:width|height)="[^"]*"/g, '')} width="${width}" height="${height}">`)
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('PNG failed')), 'image/png'))
  }
  finally {
    URL.revokeObjectURL(url)
  }
}

/** Saves a file under `filename`. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Puts the PNG on the clipboard as an image. Called straight from the click, the blob still on its
 * way: Safari only allows the write while the click is fresh, and takes the promise for the content.
 */
export function copyPng(png: Promise<Blob>): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return Promise.reject(new Error('No image clipboard'))
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

/** Puts the SVG code on the clipboard as text (Figma and most design tools paste it as vectors). */
export function copySvg(svg: Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    return navigator.clipboard.write([new ClipboardItem({ 'text/plain': svg.then((t) => new Blob([t], { type: 'text/plain' })) })])
      .catch(async () => navigator.clipboard.writeText(await svg))
  }
  return svg.then((t) => navigator.clipboard.writeText(t))
}

/** An animal drawn in a colour's shade (CmsAnimal's inline drawing) as a file of its own. */
export function tintedSvg(drawing: { viewBox: string; inner: string }, body: string, face: string): string {
  const inner = drawing.inner
    .replace(/class="cms-animal__body"/g, `fill="${body}"`)
    .replace(/class="cms-animal__face"/g, `fill="${face}"`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${drawing.viewBox}">${inner}</svg>\n`
}
