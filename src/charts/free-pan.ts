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
    // Ignore interactive UI chrome inside container
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
    if (dy === 0) return
    lastY = e.clientY

    // Convert pixel delta → price delta (Y grows downward)
    const p0 = series.coordinateToPrice(0)
    const p1 = series.coordinateToPrice(dy)
    if (p0 == null || p1 == null) return
    const dPrice = p0 - p1
    if (!Number.isFinite(dPrice) || dPrice === 0) return

    minValue += dPrice
    maxValue += dPrice
    applyPriceRange(minValue, maxValue)
  }

  const endDrag = (e?: PointerEvent) => {
    if (!dragging) return
    dragging = false
    if (pointerId != null) {
      try {
        container.releasePointerCapture(pointerId)
      } catch {
        /* */
      }
      pointerId = null
    }
    if (isEnabled()) container.style.cursor = 'grab'
    else container.style.cursor = ''
    void e
  }

  const onDblClick = (e: MouseEvent) => {
    if (!isEnabled()) return
    const t = e.target as HTMLElement | null
    if (t?.closest?.('button, input, select, a, [data-no-pan]')) return
    // Restore auto scale on double-click (same idea as axis double-click)
    if (priceLocked) {
      e.preventDefault()
      e.stopPropagation()
      resetAutoScale()
    }
  }

  const syncCursor = () => {
    if (!dragging) {
      container.style.cursor = isEnabled() ? 'grab' : ''
    }
  }

  // Capture phase so we run alongside LWC’s own handlers
  container.addEventListener('pointerdown', onPointerDown, true)
  container.addEventListener('pointermove', onPointerMove, true)
  container.addEventListener('pointerup', endDrag, true)
  container.addEventListener('pointercancel', endDrag, true)
  container.addEventListener('dblclick', onDblClick, true)
  syncCursor()

  // Poll enable state for cursor when tool toggles without pointer move
  const cursorTimer = window.setInterval(syncCursor, 400)

  return () => {
    window.clearInterval(cursorTimer)
    container.removeEventListener('pointerdown', onPointerDown, true)
    container.removeEventListener('pointermove', onPointerMove, true)
    container.removeEventListener('pointerup', endDrag, true)
    container.removeEventListener('pointercancel', endDrag, true)
    container.removeEventListener('dblclick', onDblClick, true)
    container.style.cursor = ''
    if (priceLocked) {
      // leave locked range until user resets – or clear on detach
      series.applyOptions({ autoscaleInfoProvider: undefined })
      chart.priceScale('right').applyOptions({ autoScale: true })
    }
  }
}
