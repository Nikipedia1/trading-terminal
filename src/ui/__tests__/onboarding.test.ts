import { describe, it, expect, beforeEach } from 'vitest'
import { resetOnboardingTour } from '../OnboardingTour'

const mem = new Map<string, string>()
// @ts-expect-error mock
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => {
    mem.set(k, v)
  },
  removeItem: (k: string) => {
    mem.delete(k)
  },
}

describe('onboarding storage', () => {
  beforeEach(() => mem.clear())

  it('reset clears completion flag', () => {
    localStorage.setItem('tt-onboarding:v1', 'done')
    resetOnboardingTour()
    expect(localStorage.getItem('tt-onboarding:v1')).toBeNull()
  })
})
