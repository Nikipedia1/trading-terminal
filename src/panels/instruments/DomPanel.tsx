/**
 * Standalone DOM ladder panel — full ladder view (not chart overlay).
 */
import { DomLadder } from '@/analysis/deepDom/DomLadder'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'

export function DomPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, exchange } = link

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11]">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] text-[11px] font-mono flex gap-2">
        <span className="text-[#f0b90b] font-semibold">DOM LADDER</span>
        <span className="text-[#848e9c]">
          {symbol} · {exchange}
        </span>
      </div>
      <div className="flex-1 min-h-0 relative">
        <DomLadder enabled exchange={exchange} symbol={symbol} depth={24} />
      </div>
    </div>
  )
}
