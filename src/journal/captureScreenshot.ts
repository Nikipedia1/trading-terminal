/**
 * Capture [data-chart-root] via html2canvas, compress to JPEG ≤ MAX_BYTES.
 * Returns dataURL or undefined on failure / missing target.
 */

import html2canvas from 'html2canvas'

const MAX_BYTES = 150 * 1024 // ~150 KB
const MAX_WIDTH = 1280

function dataUrlByteLength(dataUrl: string): number {
  // rough base64 payload size (ignore header)
  const i = dataUrl.indexOf(',')
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  return Math.ceil((b64.length * 3) / 4)
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality)
}

/** Scale canvas down so longest side ≤ maxW, return new canvas */
function scaleCanvas(src: HTMLCanvasElement, maxW: number): HTMLCanvasElement {
  if (src.width <= maxW) return src
  const scale = maxW / src.width
  const w = Math.round(src.width * scale)
  const h = Math.round(src.height * scale)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) return src
  ctx.drawImage(src, 0, 0, w, h)
  return out
}

/**
 * Capture the first [data-chart-root] element.
 * Compresses via scale + JPEG quality loop until ≤ MAX_BYTES.
 */
export async function captureChartScreenshot(): Promise<string | undefined> {
  const el = document.querySelector('[data-chart-root]') as HTMLElement | null
  if (!el) return undefined

  try {
    const raw = await html2canvas(el, {
      backgroundColor: '#0b0e11',
      scale: 1,
      logging: false,
      useCORS: true,
      allowTaint: true,
    })

    let canvas = scaleCanvas(raw, MAX_WIDTH)
    let quality = 0.82
    let dataUrl = canvasToJpeg(canvas, quality)

    // Quality ladder until under budget
    while (dataUrlByteLength(dataUrl) > MAX_BYTES && quality > 0.35) {
      quality -= 0.12
      dataUrl = canvasToJpeg(canvas, quality)
    }

    // Still too big → harder scale
    if (dataUrlByteLength(dataUrl) > MAX_BYTES) {
      canvas = scaleCanvas(raw, 900)
      quality = 0.7
      dataUrl = canvasToJpeg(canvas, quality)
      while (dataUrlByteLength(dataUrl) > MAX_BYTES && quality > 0.3) {
        quality -= 0.1
        dataUrl = canvasToJpeg(canvas, quality)
      }
    }

    if (dataUrlByteLength(dataUrl) > MAX_BYTES * 1.5) {
      // give up rather than blow localStorage
      return undefined
    }

    return dataUrl
  } catch {
    return undefined
  }
}
