import { useMemo, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { FourierView } from './FourierView'
import { QuantConceptsView } from './QuantConceptsView'
import { Fourier3DView } from './Fourier3DView'

type Tab = 'fourier' | 'concepts' | 'fourier3d'

export function QuantLabPanel() {
  const candles = useMarketStore((s) => s.candles)
  const symbol = useMarketStore((s) => s.symbol)
  const interval = useMarketStore((s) => s.interval)
  const [tab, setTab] = useState<Tab>('fourier')
  const [harmonics, setHarmonics] = useState(8)

  const n = candles.length
  const tabs: { id: Tab; label: string }[] = [
    { id: 'fourier', label: 'Fourier 2D' },
    { id: 'fourier3d', label: 'Fourier 3D' },
    { id: 'concepts', label: 'Quant Concepts' },
  ]

  const ready = useMemo(() => n >= 32, [n])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef]">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#2b3139] shrink-0">
        <span className="text-[11px] font-semibold text-[#f0b90b] tracking-wide">QUANT LAB</span>
        <span className="text-[10px] text-[#848e9c] font-mono">
          {symbol} · {interval} · n={n}
        </span>
        <div className="ml-auto flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`text-[10px] px-2 py-0.5 rounded border ${
                tab === t.id
                  ? 'border-[#f0b90b]/50 bg-[#f0b90b]/15 text-[#f0b90b]'
                  : 'border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {!ready ? (
          <div className="p-4 text-[12px] text-[#848e9c]">
            Need at least ~32 candles on the active chart. Load history / start live.
          </div>
        ) : tab === 'fourier' ? (
          <FourierView candles={candles} harmonics={harmonics} onHarmonics={setHarmonics} />
        ) : tab === 'fourier3d' ? (
          <Fourier3DView candles={candles} harmonics={harmonics} />
        ) : (
          <QuantConceptsView candles={candles} intervalHint={interval} />
        )}
      </div>
    </div>
  )
}
