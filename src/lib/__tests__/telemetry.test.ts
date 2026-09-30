import { describe, it, expect } from 'vitest'
import { captureException, captureMessage, isTelemetryEnabled } from '../telemetry'

describe('telemetry', () => {
  it('does not throw without DSN', () => {
    expect(() => captureException(new Error('test'))).not.toThrow()
    expect(() => captureMessage('hello')).not.toThrow()
  })

  it('reports disabled without env', () => {
    expect(isTelemetryEnabled()).toBe(false)
  })
})
