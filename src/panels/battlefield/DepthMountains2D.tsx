/** 2D depth mountains overlay — green bids / red asks */
export function DepthMountains2D({
  bids,
  asks,
}: {
  bids?: { price: number; qty: number }[]
  asks?: { price: number; qty: number }[]
}) {
  const n = 24
  const b = (bids ?? []).slice(0, n)
  const a = (asks ?? []).slice(0, n)
  const maxQ = Math.max(
    0.0001,
    ...b.map((l) => l.qty),
    ...a.map((l) => l.qty)
  )
  const W = 320
  const H = 56
  const mid = W / 2
  const pathSide = (levels: { qty: number }[], fromMid: boolean): string => {
    if (!levels.length) return ''
    const pts: string[] = [`${mid},${H}`]
    levels.forEach((l, i) => {
      const t = (i + 1) / Math.max(levels.length, 1)
      const x = fromMid ? mid + t * (mid - 4) : mid - t * (mid - 4)
      const y = H - (l.qty / maxQ) * (H - 6)
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    })
    pts.push(fromMid ? `${W - 2},${H}` : `2,${H}`)
    return `M ${pts.join(' L ')} Z`
  }
  const bullPath = pathSide(b, false)
  const bearPath = pathSide(a, true)
  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none w-[min(100%,340px)] px-2">
      <div className="rounded-md border border-[#2b3139]/90 bg-[#0b0e11]/80 backdrop-blur-sm px-2 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
        <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#5e6673] mb-0.5 px-0.5">
          <span className="text-[#0ecb81]">Bid mountains</span>
          <span className="text-[#848e9c]">2D depth</span>
          <span className="text-[#f6465d]">Ask mountains</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14 block" aria-hidden>
          <defs>
            <linearGradient id="bf-bull" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ecb81" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0ecb81" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="bf-bear" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f6465d" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#f6465d" stopOpacity="0.08" />
            </linearGradient>
          </defs>
          {bullPath ? (
            <path d={bullPath} fill="url(#bf-bull)" stroke="#0ecb81" strokeWidth="1" />
          ) : null}
          {bearPath ? (
            <path d={bearPath} fill="url(#bf-bear)" stroke="#f6465d" strokeWidth="1" />
          ) : null}
          <line
            x1={mid}
            y1="0"
            x2={mid}
            y2={H}
            stroke="#f0b90b"
            strokeOpacity="0.35"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        </svg>
      </div>
    </div>
  )
}
