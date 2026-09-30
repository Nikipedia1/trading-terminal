/**
 * Free 2D chart pan for lightweight-charts.
 * Library pans time on main-area drag; this module also pans price (vertical)
 * while the drawing tool is "pan", locking autoScale via autoscaleInfoProvider.
 * Double-click on the chart area restores auto scale.
 */

import type { IChartApi, ISeriesApi } from 'lightweight-charts'

export interface FreePanHandles {
  chart: IChartApi
  series: ISeriesApi<'Candlestick'>
  container: HTMLElement
}

/**
 * Attach free vertical (+ optional assist) pan. Returns cleanup.
 * Horizontal scroll remains handled by LWC handleScroll.pressedMouseMove.
 */
export function attachFreePan(
  { chart, series, container }: FreePanHandles,
  isEnabled: () => boolean
): () => void {
  let dragging = false
  let lastY = 0
  let minValue = 0
  let maxValue = 0
  let priceLocked = false
  let pointerId: number | null = null

  const readVisiblePrice = (): { min: number; max: number } | null => {
    const h = container.clientHeight
    if (h <= 0) return null
    const top = series.coordinateToPrice(0)
    const bottom = series.coordinateToPrice(h)
    if (top == null || bottom == null) return null
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null
    return { min: Math.min(top, bottom), max: Math.max(top, bottom) }
  }

  const applyPriceRange = (min: number, max: number) => {
    if (!(max > min)) return
    priceLocked = true
    chart.priceScale('right').applyOptions({ autoScale: false })
    series.applyOptions({
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: min, maxValue: max },
      }),
    })
  }

  const resetAutoScale = () => {
    priceLocked = false
    series.applyOptions({
      autoscaleInfoProvider: undefined,
    })
    chart.priceScale('right').applyOptions({ autoScale: true })
  }

  const onPointerDown = (e: PointerEvent) => {
    if (!isEnabled()) return
    if (e.button !== 0) return
    const t = e.target as HTMLElement | null
    if (t?.closest?.('button, input, select, a, [data-no-pan]')) return

    const range = readVisiblePrice()
    if (!range) return

    dragging = true
    lastY = e.clientY
    minValue = range.min
    maxValue = range.max
    pointerId = e.pointerId
    try {
      container.setPointerCapture(e.pointerId)
    } catch {
      /* */
    }
    container.style.cursor = 'grabbing'
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging || !isEnabled()) return
    const dy = e.clientY - lastY
    lastY = e.clientY
    const h = container.clientHeight || 1
    const span = maxValue - minValue
    if (!(span > 0)) return
    const dPrice = (dy / h) * span
    minValue += dPrice
    maxValue += dPrice
    applyPriceRange(minValue, maxValue)
  }

  const endDrag = (e: PointerEvent) => {
    if (!dragging) return
    dragging = false
    if (pointerId != null) {
      try {
        container.releasePointerCapture(pointerId)
      } catch {
        /* */
      }
    }
    pointerId = null
    if (isEnabled()) container.style.cursor = 'grab'
  }

  const onDblClick = (e: MouseEvent) => {
    if (!isEnabled()) return
    const t = e.target as HTMLElement | null
    if (t?.closest?.('button, input, select, a, [data-no-pan]')) return
    resetAutoScale()
  }

  container.addEventListener('pointerdown', onPointerDown)
  container.addEventListener('pointermove', onPointerMove)
  container.addEventListener('pointerup', endDrag)
  container.addEventListener('pointercancel', endDrag)
  container.addEventListener('dblclick', onDblClick)

  return () => {
    container.removeEventListener('pointerdown', onPointerDown)
    container.removeEventListener('pointermove', onPointerMove)
    container.removeEventListener('pointerup', endDrag)
    container.removeEventListener('pointercancel', endDrag)
    container.removeEventListener('dblclick', onDblClick)
    if (priceLocked) resetAutoScale()
  }
}

/** Clear free-pan lock so the scale becomes reactive again (any symbol). */
export function unlockPriceScale(
  chart: IChartApi,
  series: ISeriesApi<'Candlestick'>
) {
  series.applyOptions({ autoscaleInfoProvider: undefined })
  chart.priceScale('right').applyOptions({ autoScale: true })
}
