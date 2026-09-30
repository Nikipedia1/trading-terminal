import { create } from 'zustand'

export type SessionMode = 'full' | 'guest-readonly'

interface SessionModeState {
  mode: SessionMode
  setMode: (m: SessionMode) => void
  isReadOnly: () => boolean
}

export const useSessionModeStore = create<SessionModeState>((set, get) => ({
  mode: 'full',
  setMode: (mode) => set({ mode }),
  isReadOnly: () => get().mode === 'guest-readonly',
}))

export function useIsReadOnly(): boolean {
  return useSessionModeStore((s) => s.mode === 'guest-readonly')
}
