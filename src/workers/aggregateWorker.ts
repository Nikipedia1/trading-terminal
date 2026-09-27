/**
 * Aggregate worker – footprint / volume profile heavy math off main thread.
 * Main thread only paints; postMessage results back.
 *
 * Usage (main):
 *   const w = new Worker(new URL('./aggregateWorker.ts', import.meta.url), { type: 'module' })
 *   w.postMessage({ type: 'volumeProfile', candles, tickSize, ... })
 *   w.onmessage = (e) => { if (e.data.type === 'volumeProfile') paint(e.data.result) }
 */

export interface WorkerRequest {
  id: string
  type: 'volumeProfile' | 'footprint' | 'ping'
  payload?: unknown
}

export interface WorkerResponse {
  id: string
  type: string
  ok: boolean
  result?: unknown
  error?: string
}

/** Lightweight VP compute (mirrors src/analysis/volumeProfile/compute – keep in sync) */
function computeVolumeProfile(payload: {
  candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>
  tickSize: number
  valueAreaPct?: number
}) {
  const { candles, tickSize } = payload
  const valueAreaPct = payload.valueAreaPct ?? 0.7
  if (!candles.length || tickSize <= 0) {
    return { bins: [], poc: null, vah: null, val: null, totalVolume: 0 }
  }

  let minP = Infinity
  let maxP = -Infinity
  for (const c of candles) {
    if (c.low < minP) minP = c.low
    if (c.high > maxP) maxP = c.high
  }
  const lo = Math.floor(minP / tickSize) * tickSize
  const hi = Math.ceil(maxP / tickSize) * tickSize
  const nBins = Math.max(1, Math.round((hi - lo) / tickSize) + 1)
  const vols = new Float64Array(nBins)

  for (const c of candles) {
    const range = c.high - c.low
    if (range <= 0 || c.volume <= 0) {
      const idx = Math.min(nBins - 1, Math.max(0, Math.round((c.close - lo) / tickSize)))
      vols[idx] += c.volume
      continue
    }
    // Distribute volume uniformly across ticks in bar range (approx)
    const i0 = Math.max(0, Math.floor((c.low - lo) / tickSize))
    const i1 = Math.min(nBins - 1, Math.ceil((c.high - lo) / tickSize))
    const span = Math.max(1, i1 - i0 + 1)
    const per = c.volume / span
    for (let i = i0; i <= i1; i++) vols[i] += per
  }

  let totalVolume = 0
  let pocIdx = 0
  for (let i = 0; i < nBins; i++) {
    totalVolume += vols[i]
    if (vols[i] > vols[pocIdx]) pocIdx = i
  }

  // Value area around POC
  let vaVol = vols[pocIdx]
  let left = pocIdx
  let right = pocIdx
  const target = totalVolume * valueAreaPct
  while (vaVol < target && (left > 0 || right < nBins - 1)) {
    const expandL = left > 0 ? vols[left - 1] : -1
    const expandR = right < nBins - 1 ? vols[right + 1] : -1
    if (expandL >= expandR && left > 0) {
      left--
      vaVol += vols[left]
    } else if (right < nBins - 1) {
      right++
      vaVol += vols[right]
    } else if (left > 0) {
      left--
      vaVol += vols[left]
    } else break
  }

  const bins = []
  for (let i = 0; i < nBins; i++) {
    if (vols[i] > 0) {
      bins.push({ price: lo + i * tickSize, volume: vols[i] })
    }
  }

  return {
    bins,
    poc: lo + pocIdx * tickSize,
    vah: lo + right * tickSize,
    val: lo + left * tickSize,
    totalVolume,
  }
}

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data
  if (!msg || !msg.id) return

  try {
    if (msg.type === 'ping') {
      const res: WorkerResponse = { id: msg.id, type: 'ping', ok: true, result: { t: Date.now() } }
      self.postMessage(res)
      return
    }

    if (msg.type === 'volumeProfile') {
      const result = computeVolumeProfile(msg.payload as any)
      const res: WorkerResponse = { id: msg.id, type: 'volumeProfile', ok: true, result }
      self.postMessage(res)
      return
    }

    if (msg.type === 'footprint') {
      // Placeholder – footprint aggregate lands here next
      const res: WorkerResponse = {
        id: msg.id,
        type: 'footprint',
        ok: true,
        result: { cells: [] },
      }
      self.postMessage(res)
      return
    }

    const res: WorkerResponse = {
      id: msg.id,
      type: msg.type,
      ok: false,
      error: `Unknown type: ${msg.type}`,
    }
    self.postMessage(res)
  } catch (e: any) {
    const res: WorkerResponse = {
      id: msg.id,
      type: msg.type,
      ok: false,
      error: e?.message || String(e),
    }
    self.postMessage(res)
  }
}

export {}
