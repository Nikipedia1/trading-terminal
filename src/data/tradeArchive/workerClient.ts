/**
 * Best-effort client for archiveWorker – fails soft if workers blocked.
 */

import type { WorkerIn, WorkerOut } from './archiveWorker'

let worker: Worker | null = null
let seq = 1
const pending = new Map<
  number,
  { resolve: (v: ArrayBuffer) => void; reject: (e: Error) => void }
>()

function getWorker(): Worker | null {
  if (worker) return worker
  if (typeof Worker === 'undefined') return null
  try {
    worker = new Worker(new URL('./archiveWorker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
      const m = ev.data
      if (m.type === 'gzip-ok') {
        pending.get(m.id)?.resolve(m.bytes)
        pending.delete(m.id)
      } else if (m.type === 'gzip-err') {
        pending.get(m.id)?.reject(new Error(m.message))
        pending.delete(m.id)
      }
    }
    worker.onerror = () => {
      worker = null
    }
    return worker
  } catch {
    return null
  }
}

/** Compress JSON string via worker; null if worker unavailable. */
export function gzipViaWorker(json: string): Promise<ArrayBuffer | null> {
  const w = getWorker()
  if (!w) return Promise.resolve(null)
  const id = seq++
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      pending.delete(id)
      resolve(null)
    }, 30_000)
    pending.set(id, {
      resolve: (buf) => {
        window.clearTimeout(timer)
        resolve(buf)
      },
      reject: () => {
        window.clearTimeout(timer)
        resolve(null)
      },
    })
    const msg: WorkerIn = { type: 'gzip', id, json }
    w.postMessage(msg)
  })
}
