/**
 * On-chain panel presentational views (no data fetching).
 */
import type { ReactNode } from 'react'
import type { OnchainSnapshot, OnchainTab } from './types'

export function fmt(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(d)}T`
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(d)}B`
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(d)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(d)}K`
  return n.toLocaleString(undefined, {
    maximumFractionDigits: d,
    minimumFractionDigits: 0,
  })
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `$${fmt(n, 2)}`
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString()
}

export function fmtPct(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(d)}%`
}

export function fmtWhen(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—'
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'up' | 'down' | 'warn' | 'neutral'
}) {
  const color =
    tone === 'up'
      ? 'text-[#0ecb81]'
      : tone === 'down'
        ? 'text-[#f6465d]'
        : tone === 'warn'
          ? 'text-[#f0b90b]'
          : 'text-[#eaecef]'
  return (
    <div className="rounded border border-[#2b3139] bg-[#0d1118] px-2 py-1.5 min-w-0">
      <div className="text-[9px] text-[#848e9c] uppercase tracking-wide truncate">{label}</div>
      <div className={`text-[13px] font-mono-nums font-semibold tabular-nums ${color}`}>{value}</div>
      {sub ? <div className="text-[9px] text-[#5e6673] truncate mt-0.5">{sub}</div> : null}
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[10px] font-semibold text-[#848e9c] uppercase tracking-wider px-0.5">{title}</h3>
      {children}
    </section>
  )
}

export function Bar({ pct }: { pct: number | null }) {
  const p = pct != null && Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0
  return (
    <div className="h-1.5 rounded bg-[#1e2329] overflow-hidden">
      <div className="h-full rounded bg-[#f0b90b]/80 transition-all" style={{ width: `${p}%` }} />
    </div>
  )
}

function fngTone(v: number | null): 'up' | 'down' | 'warn' | 'neutral' {
  if (v == null) return 'neutral'
  if (v >= 55) return 'up'
  if (v <= 40) return 'down'
  return 'warn'
}

export function OnchainBody({ tab, data }: { tab: OnchainTab; data: OnchainSnapshot }) {
  const btc = data.btc
  const eth = data.eth
  const defi = data.defi
  const market = data.market

  if (tab === 'overview') {
    return (
      <>
        <Section title="Market sentiment">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="Fear & Greed" value={market.fearGreed != null ? `${market.fearGreed}` : '—'} sub={market.fearGreedLabel ?? undefined} tone={fngTone(market.fearGreed)} />
            <Metric label="DeFi TVL" value={fmtUsd(defi.totalTvlUsd)} sub="all chains" />
            <Metric label="Stablecoins" value={fmtUsd(defi.stablecoinMcapUsd)} sub="pegged USD circ." />
            <Metric label="ETH gas" value={eth.gasGwei != null ? `${fmt(eth.gasGwei, 1)} gwei` : '—'} sub={eth.baseFeeGwei != null ? `base ${fmt(eth.baseFeeGwei, 1)}` : undefined} />
          </div>
        </Section>
        <Section title="Bitcoin network">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="Height" value={fmtInt(btc.height)} />
            <Metric label="Hashrate" value={btc.hashrateEh != null ? `${fmt(btc.hashrateEh, 2)} EH/s` : '—'} />
            <Metric label="Fee (fast)" value={btc.fees.fastest != null ? `${btc.fees.fastest} sat/vB` : '—'} sub={btc.fees.economy != null ? `econ ${btc.fees.economy} sat/vB` : undefined} />
            <Metric label="Mempool" value={fmtInt(btc.mempoolTxCount)} sub={btc.mempoolVsize != null ? `${fmt(btc.mempoolVsize / 1e6, 2)} MvB` : undefined} />
          </div>
          {btc.difficultyProgressPct != null ? (
            <div className="mt-1.5 space-y-1">
              <div className="flex justify-between text-[9px] text-[#848e9c]">
                <span>Difficulty epoch</span>
                <span>{fmt(btc.difficultyProgressPct, 1)}%</span>
              </div>
              <Bar pct={btc.difficultyProgressPct} />
              <div className="text-[9px] text-[#5e6673]">
                Δ est. {fmtPct(btc.difficultyChangePct)} · retarget {fmtWhen(btc.estimatedRetargetDate)} · {fmtInt(btc.remainingBlocks)} blocks left
              </div>
            </div>
          ) : null}
        </Section>
        <Section title="Top chains by TVL">
          <ul className="space-y-1">
            {defi.chains.slice(0, 6).map((c, i) => (
              <li key={c.name} className="flex items-center gap-2 text-[10px] px-1 py-0.5 rounded hover:bg-[#12161c]">
                <span className="text-[#5e6673] w-4 tabular-nums">{i + 1}</span>
                <span className="flex-1 truncate text-[#eaecef]">{c.name}</span>
                <span className="font-mono-nums text-[#848e9c]">{fmtUsd(c.tvl)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </>
    )
  }

  if (tab === 'btc') {
    return (
      <>
        <Section title="Security & work">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="Block height" value={fmtInt(btc.height)} />
            <Metric label="Hashrate" value={btc.hashrateEh != null ? `${fmt(btc.hashrateEh, 3)} EH/s` : '—'} sub="3d avg (mempool.space)" />
            <Metric label="Difficulty" value={btc.difficulty != null ? fmt(btc.difficulty, 2) : '—'} />
            <Metric label="Epoch progress" value={btc.difficultyProgressPct != null ? `${fmt(btc.difficultyProgressPct, 2)}%` : '—'} sub={`${fmtInt(btc.remainingBlocks)} blocks left`} />
          </div>
          <div className="mt-1.5 space-y-1">
            <Bar pct={btc.difficultyProgressPct} />
            <div className="text-[9px] text-[#5e6673]">
              Next retarget ~ {fmtWhen(btc.estimatedRetargetDate)} · expected Δ{' '}
              <span className={(btc.difficultyChangePct ?? 0) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{fmtPct(btc.difficultyChangePct)}</span>
            </div>
          </div>
        </Section>
        <Section title="Fee market (sat/vB)">
          <div className="grid grid-cols-3 gap-1.5">
            <Metric label="Fastest" value={fmtInt(btc.fees.fastest)} tone="warn" />
            <Metric label="30 min" value={fmtInt(btc.fees.halfHour)} />
            <Metric label="1 hour" value={fmtInt(btc.fees.hour)} />
            <Metric label="Economy" value={fmtInt(btc.fees.economy)} />
            <Metric label="Minimum" value={fmtInt(btc.fees.minimum)} />
            <Metric label="Mempool txs" value={fmtInt(btc.mempoolTxCount)} sub={btc.mempoolVsize != null ? `${fmt(btc.mempoolVsize / 1e6, 2)} MvB` : undefined} />
          </div>
        </Section>
        {btc.lightning ? (
          <Section title="Lightning Network">
            <div className="grid grid-cols-3 gap-1.5">
              <Metric label="Nodes" value={fmtInt(btc.lightning.nodeCount)} />
              <Metric label="Channels" value={fmtInt(btc.lightning.channelCount)} />
              <Metric label="Capacity" value={btc.lightning.totalCapacityBtc != null ? `${fmt(btc.lightning.totalCapacityBtc, 2)} BTC` : '—'} />
            </div>
          </Section>
        ) : null}
      </>
    )
  }

  if (tab === 'eth') {
    return (
      <>
        <Section title="Execution layer">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric
              label="Gas price"
              value={eth.gasGwei != null ? `${fmt(eth.gasGwei, 2)} gwei` : '—'}
              tone={eth.gasGwei != null && eth.gasGwei > 50 ? 'warn' : eth.gasGwei != null && eth.gasGwei < 15 ? 'up' : 'neutral'}
            />
            <Metric label="Base fee" value={eth.baseFeeGwei != null ? `${fmt(eth.baseFeeGwei, 2)} gwei` : '—'} sub="latest block" />
            <Metric label="Ethereum TVL" value={fmtUsd(eth.tvlUsd)} sub="DefiLlama chain TVL" />
            <Metric
              label="Share of DeFi"
              value={eth.tvlUsd != null && defi.totalTvlUsd != null && defi.totalTvlUsd > 0 ? `${((eth.tvlUsd / defi.totalTvlUsd) * 100).toFixed(1)}%` : '—'}
            />
          </div>
        </Section>
        <p className="text-[9px] text-[#5e6673] leading-relaxed px-0.5">
          Gas from public Ethereum RPC (publicnode). TVL from DefiLlama. No private mempool or proprietary flow data.
        </p>
      </>
    )
  }

  return (
    <>
      <Section title="Totals">
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Total TVL" value={fmtUsd(defi.totalTvlUsd)} />
          <Metric label="Stablecoin mcap" value={fmtUsd(defi.stablecoinMcapUsd)} sub="USD-pegged circulating" />
        </div>
      </Section>
      <Section title="Chains">
        <ul className="space-y-0.5">
          {defi.chains.map((c, i) => {
            const share = defi.totalTvlUsd && defi.totalTvlUsd > 0 ? (c.tvl / defi.totalTvlUsd) * 100 : null
            return (
              <li key={c.name} className="px-1 py-1 rounded hover:bg-[#12161c]">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-[#5e6673] w-4">{i + 1}</span>
                  <span className="flex-1 truncate text-[#eaecef]">{c.name}</span>
                  <span className="font-mono-nums text-[#848e9c]">{fmtUsd(c.tvl)}</span>
                  <span className="text-[#5e6673] w-12 text-right tabular-nums">{share != null ? `${share.toFixed(1)}%` : ''}</span>
                </div>
                <Bar pct={share} />
              </li>
            )
          })}
        </ul>
      </Section>
      <Section title="Top protocols">
        <ul className="space-y-1">
          {defi.topProtocols.map((p, i) => (
            <li key={`${p.name}-${i}`} className="flex items-center gap-2 text-[10px] px-1 py-0.5 rounded hover:bg-[#12161c]">
              <span className="text-[#5e6673] w-4">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate text-[#eaecef]">{p.name}</div>
                <div className="text-[9px] text-[#5e6673] truncate">{p.chain} · {p.category}</div>
              </div>
              <span className="font-mono-nums text-[#848e9c] shrink-0">{fmtUsd(p.tvl)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
