import { describe, it, expect, beforeEach } from 'vitest'
import { recordApiCall, getMetricsSnapshot, resetMetrics } from '../metrics'

describe('metrics', () => {
  beforeEach(() => resetMetrics())

  it('tracks api success and error rates', () => {
    recordApiCall('news', 40, true)
    recordApiCall('news', 80, false, 'timeout')
    const snap = getMetricsSnapshot()
    const row = snap.rows.find((r) => r.name === 'api:news')
    expect(row?.count).toBe(2)
    expect(row?.errors).toBe(1)
    expect(row?.errorRate).toBe(0.5)
  })
})
