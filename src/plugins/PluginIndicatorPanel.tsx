import { useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { runIndicatorPlugin } from './indicatorSandbox'
import { FEATURES } from '@/lib/features'

const SAMPLE = `function indicator(o, h, l, c, v) {
  const p = 10;
  return c.map((_, i) => {
    if (i < p - 1) return null;
    let s = 0;
    for (let j = 0; j < p; j++) s += c[i - j];
    return s / p;
  });
}`

export function PluginIndicatorPanel() {
  const candles = useMarketStore((s) => s.candles)
  const [code, setCode] = useState(SAMPLE)
  const [preview, setPreview] = useState('')
  const [err, setErr] = useState('')

  if (!FEATURES.indicatorPlugins) {
    return (
      <div className="p-3 text-[11px] text-[#848e9c]">
        Indicator plugins disabled (VITE_INDICATOR_PLUGINS=0)
      </div>
    )
  }

  const run = () => {
    const r = runIndicatorPlugin(code, {
      open: candles.map((x) => x.open),
      high: candles.map((x) => x.high),
      low: candles.map((x) => x.low),
      close: candles.map((x) => x.close),
      volume: candles.map((x) => x.volume ?? 0),
    })
    if (r.error) {
      setErr(r.error)
      setPreview('')
      return
    }
    setErr('')
    const last = r.values.filter((x) => x != null).slice(-5)
    setPreview(last.map((x) => (x as number).toFixed(4)).join(', '))
  }

  return (
    <div className="h-full flex flex-col text-[11px] bg-[#0b0e11] text-[#eaecef]">
      <div className="px-2 py-1.5 border-b border-[#1e2329] font-semibold text-[#f0b90b]">
        Plugin indicator (sandbox)
      </div>
      <textarea
        className="flex-1 min-h-[8rem] m-2 font-mono text-[10px] bg-[#12161c] border border-[#2b3139] rounded p-2"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
      />
      <div className="px-2 pb-2 flex gap-2 items-center">
        <button
          type="button"
          onClick={run}
          className="px-2 py-1 rounded bg-[#f0b90b] text-[#0b0e11] font-medium"
        >
          Run
        </button>
        {err && <span className="text-[#f6465d] text-[10px]">{err}</span>}
        {preview && !err && (
          <span className="text-[#0ecb81] text-[10px] font-mono">last: {preview}</span>
        )}
      </div>
    </div>
  )
}
