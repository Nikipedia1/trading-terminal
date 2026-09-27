/**
 * Optional best-effort worker: gzip JSON batches offline the main thread.
 * Not required for trading or archiving – only speeds large exports.
 *
 * Loaded via `new Worker(new URL('./archiveWorker.ts', import.meta.url), { type: 'module' })`
 */

export type WorkerIn =
  | { type: 'gzip'; id: number; json: string }
  | { type: 'ping'; id: number }

export type WorkerOut =
  | { type: 'gzip-ok'; id: number; bytes: ArrayBuffer }
  | { type: 'gzip-err'; id: number; message: string }
  | { type: 'pong'; id: number }

self.onmessage = async (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data
  if (msg.type === 'ping') {
    ;(self as unknown as Worker).postMessage({ type: 'pong', id: msg.id } satisfies WorkerOut)
    return
  }
  if (msg.type === 'gzip') {
    try {
      if (typeof CompressionStream === 'undefined') {
        throw new Error('CompressionStream unavailable')
      }
      const stream = new Blob([msg.json]).stream().pipeThrough(new CompressionStream('gzip'))
      const buf = await new Response(stream).arrayBuffer()
      ;(self as unknown as Worker).postMessage(
        { type: 'gzip-ok', id: msg.id, bytes: buf } satisfies WorkerOut,
        [buf]
      )
    } catch (e) {
      ;(self as unknown as Worker).postMessage({
        type: 'gzip-err',
        id: msg.id,
        message: e instanceof Error ? e.message : 'gzip failed',
      } satisfies WorkerOut)
    }
  }
}

export {}
