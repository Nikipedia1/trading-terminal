/** Sliding-window buffer of L2 snapshots for DeepDom. */

import type { DomSnapshot, DeepDomConfig } from './types'

export class DomSnapshotBuffer {
  private items: DomSnapshot[] = []
  private maxItems: number

  constructor(windowMinutes: number, sampleMs: number) {
    this.maxItems = Math.max(30, Math.ceil((windowMinutes * 60_000) / sampleMs) + 5)
  }

  reconfigure(cfg: DeepDomConfig) {
    this.maxItems = Math.max(30, Math.ceil((cfg.windowMinutes * 60_000) / cfg.sampleMs) + 5)
    this.trim()
  }

  push(snap: DomSnapshot) {
    this.items.push(snap)
    this.trim()
  }

  private trim() {
    while (this.items.length > this.maxItems) this.items.shift()
  }

  clear() {
    this.items = []
  }

  /** Last snapshot (for prev-map seeding outside sample) */
  last(): DomSnapshot | null {
    return this.items.length ? this.items[this.items.length - 1] : null
  }

  /** All snapshots still inside the time window */
  list(nowSec = Math.floor(Date.now() / 1000), windowMinutes = 5): DomSnapshot[] {
    const from = nowSec - windowMinutes * 60
    return this.items.filter((s) => s.timeSec >= from)
  }

  get size() {
    return this.items.length
  }
}
