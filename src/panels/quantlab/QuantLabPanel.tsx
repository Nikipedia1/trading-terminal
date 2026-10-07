import { useMemo, useState } from 'react'
import { FourierView } from './FourierView'
import { QuantConceptsView } from './QuantConceptsView'
import { Fourier3DView } from './Fourier3DView'
import { useChartLink } from '@/hooks/useChartLink'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { ChartLinkBar } from '@/ui/ChartLinkBar'

type Tab = 'fourier' | 'concepts' | 'fourier3d'

export function QuantLabPanel() {
  const link = useChartLink('follow')
  const { candles, status } = usePanelMarket(link.symbol, link.interval, link.exchange)
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
          {link.symbol} · {link.interval} · n={n}
          {status !== 'connected' ? ` · ${status}` : ''}
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

      <ChartLinkBar
        dense
        mode={link.mode}
        setMode={link.setMode}
        panels={link.panels}
        linkedPanelId={link.linkedPanelId}
        setLinkedPanelId={link.setLinkedPanelId}
        symbol={link.symbol}
        interval={link.interval}
        exchange={link.exchange}
        customSymbol={link.customSymbol}
        setCustomSymbol={link.setCustomSymbol}
        customInterval={link.customInterval}
        setCustomInterval={link.setCustomInterval}
        customExchange={link.customExchange}
        setCustomExchange={link.setCustomExchange}
        applyToChart={link.applyToChart}
        makePrimary={link.makePrimary}
        isPrimary={link.isPrimary}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        {!ready ? (
          <div className="p-4 text-[12px] text-[#848e9c]">
            Need at least ~32 candles. Select a chart above or set Own symbol/TF and wait for history.
          </div>
        ) : tab === 'fourier' ? (
          <FourierView candles={candles} harmonics={harmonics} onHarmonics={setHarmonics} />
        ) : tab === 'fourier3d' ? (
          <Fourier3DView candles={candles} harmonics={harmonics} />
        ) : (
          <QuantConceptsView candles={candles} intervalHint={link.interval} />
        )}
      </div>
    </div>
  )
}
