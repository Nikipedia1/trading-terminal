import { describe, it, expect, beforeEach } from 'vitest'
import { setFeatureOverride, listFeatureOverrides, FEATURES } from '../features'

describe('feature flags', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem('tt-feature-flags:v1')
    } catch {
      /* */
    }
  })

  it('runtime override wins', () => {
    setFeatureOverride('newsPanel', false)
    expect(listFeatureOverrides().newsPanel).toBe(false)
    expect(FEATURES.newsPanel).toBe(false)
    setFeatureOverride('newsPanel', null)
  })
})
