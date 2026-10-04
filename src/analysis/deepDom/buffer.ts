/** Sliding-window buffer of L2 snapshots for DeepDom – O(1) ring buffer. */

import type { DomSnapshot, DeepDomConfig } from './types'

export class DomSnapshotBuffer {
  private buf: (DomSnapshot | undefined)[]
  private head = 0 // index of oldest element
  private count = 0
  private maxItems: number

  constructor(windowMinutes: number, sampleMs: number) {
    this.maxItems = Math.max(30, Math.ceil((windowMinutes * 60_000) / sampleMs) + 5)
    this.buf = new Array(this.maxItems)
  }

  reconfigure(cfg: DeepDomConfig) {
    const next = Math.max(30, Math.ceil((cfg.windowMinutes * 60_000) / cfg.sampleMs) + 5)
    if (next === this.maxItems) return
    // Rebuild into a fresh ring preserving chronological order (oldest → newest)
    const kept = this.toArray()
    this.maxItems = next
    this.buf = new Array(next)
    this.head = 0
    this.count = 0
    const start = Math.max(0, kept.length - next)
    for (let i = start; i < kept.length; i++) this.push(kept[i])
  }

  push(snap: DomSnapshot) {
    if (this.count < this.maxItems) {
      const idx = (this.head + this.count) % this.maxItems
      this.buf[idx] = snap
      this.count++
    } else {
      // Overwrite oldest
      this.buf[this.head] = snap
      this.head = (this.head + 1) % this.maxItems
    }
  }

  clear() {
    this.buf = new Array(this.maxItems)
    this.head = 0
    this.count = 0
  }

  /** Last snapshot (for prev-map seeding outside sample) */
  last(): DomSnapshot | null {
    if (this.count === 0) return null
    const idx = (this.head + this.count - 1) % this.maxItems
    return this.buf[idx] ?? null
  }

  /** All snapshots still inside the time window (chronological order) */
  list(nowSec = Math.floor(Date.now() / 1000), windowMinutes = 5): DomSnapshot[] {
    const from = nowSec - windowMinutes * 60
    const out: DomSnapshot[] = []
    for (let i = 0; i < this.count; i++) {
      const s = this.buf[(this.head + i) % this.maxItems]
      if (s && s.timeSec >= from) out.push(s)
    }
    return out
  }

  /** Alias used by DeepDomOverlay paint path */
  getSnapshots(nowSec?: number, windowMinutes?: number): DomSnapshot[] {
    return this.list(nowSec, windowMinutes)
  }

  get size() {
    return this.count
  }

  /** Internal: chronological copy (oldest first) */
  private toArray(): DomSnapshot[] {
    const out: DomSnapshot[] = []
    for (let i = 0; i < this.count; i++) {
      const s = this.buf[(this.head + i) % this.maxItems]
      if (s) out.push(s)
    }
    return out
  }
}
