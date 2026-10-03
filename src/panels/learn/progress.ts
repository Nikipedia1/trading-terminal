/** Completati Learn → localStorage (tt-learn:v1). */

const KEY = 'tt-learn:v1'

export interface LearnProgress {
  completed: Record<string, number>
}

function read(): LearnProgress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { completed: {} }
    const parsed = JSON.parse(raw) as LearnProgress
    if (!parsed || typeof parsed !== 'object') return { completed: {} }
    return { completed: parsed.completed && typeof parsed.completed === 'object' ? parsed.completed : {} }
  } catch {
    return { completed: {} }
  }
}

function write(p: LearnProgress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* quota / private mode */
  }
}

export function isCompleted(id: string): boolean {
  return !!read().completed[id]
}

export function getCompletedMap(): Record<string, number> {
  return { ...read().completed }
}

export function setCompleted(id: string, done: boolean): Record<string, number> {
  const p = read()
  if (done) p.completed[id] = Date.now()
  else delete p.completed[id]
  write(p)
  return { ...p.completed }
}

export function clearAllCompleted(): void {
  write({ completed: {} })
}
