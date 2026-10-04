/**
 * On-chain panel presentational views (no data fetching).
 */
import type { ReactNode } from 'react'
import type { OnchainSnapshot, OnchainTab, UtxoChainStats } from './types'

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

export function Bar({ pct }: { pct: number | null | undefined }) {
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

function UtxoNetworkView({
  title,
  unit,
  data,
}: {
  title: string
  unit: string
  data: UtxoChainStats
}) {
  return (
    <>
      <Section title={`${title} – security`}>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Block height" value={fmtInt(data.height)} />
          <Metric label="Hashrate" value={data.hashrateEh != null ? `${fmt(data.hashrateEh, 3)} EH/s` : '—'} />
          <Metric label="Difficulty" value={data.difficulty != null ? fmt(data.difficulty, 2) : '—'} />
          <Metric
            label="Epoch progress"
            value={data.difficultyProgressPct != null ? `${fmt(data.difficultyProgressPct, 2)}%` : '—'}
            sub={`${fmtInt(data.remainingBlocks)} blocks left`}
          />
        </div>
        <div className="mt-1.5 space-y-1">
          <Bar pct={data.difficultyProgressPct} />
          <div className="text-[9px] text-[#5e6673]">
            Retarget ~ {fmtWhen(data.estimatedRetargetDate)} · Δ{' '}
            <span className={(data.difficultyChangePct ?? 0) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
              {fmtPct(data.difficultyChangePct)}
            </span>
          </div>
        </div>
      </Section>
      <Section title={`Fee market (sat/vB) · ${unit}`}>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Fastest" value={fmtInt(data.fees.fastest)} tone="warn" />
          <Metric label="30 min" value={fmtInt(data.fees.halfHour)} />
          <Metric label="1 hour" value={fmtInt(data.fees.hour)} />
          <Metric label="Economy" value={fmtInt(data.fees.economy)} />
          <Metric label="Minimum" value={fmtInt(data.fees.minimum)} />
          <Metric
            label="Mempool txs"
            value={fmtInt(data.mempoolTxCount)}
            sub={data.mempoolVsize != null ? `${fmt(data.mempoolVsize / 1e6, 2)} MvB` : undefined}
          />
        </div>
      </Section>
      {data.pools?.length ? (
        <Section title="Mining pools (7d)">
          <ul className="space-y-1">
            {data.pools.map((p) => (
              <li key={p.name} className="px-1 py-0.5">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="flex-1 truncate text-[#eaecef]">{p.name}</span>
                  <span className="text-[#5e6673]">{fmtInt(p.blockCount)} blk</span>
                  <span className="font-mono-nums text-[#848e9c] w-14 text-right">{fmt(p.sharePct, 1)}%</span>
                </div>
                <Bar pct={p.sharePct} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {data.lightning ? (
        <Section title="Lightning">
          <div className="grid grid-cols-3 gap-1.5">
            <Metric label="Nodes" value={fmtInt(data.lightning.nodeCount)} />
            <Metric label="Channels" value={fmtInt(data.lightning.channelCount)} />
            <Metric
              label="Capacity"
              value={
                data.lightning.totalCapacityBtc != null
                  ? `${fmt(data.lightning.totalCapacityBtc, 2)} ${unit}`
                  : '—'
              }
            />
          </div>
        </Section>
      ) : null}
    </>
  )
}

export function OnchainBody({ tab, data }: { tab: OnchainTab; data: OnchainSnapshot }) {
  const btc = data.btc
  const ltc = data.ltc
  const eth = data.eth
  const sol = data.sol
  const defi = data.defi
  const market = data.market
  const alts = data.alts

  if (tab === 'overview') {
    return (
      <>
        <Section title="Market sentiment">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric
              label="Fear & Greed"
              value={market.fearGreed != null ? `${market.fearGreed}` : '—'}
              sub={market.fearGreedLabel ?? undefined}
              tone={fngTone(market.fearGreed)}
            />
            <Metric label="DeFi TVL" value={fmtUsd(defi.totalTvlUsd)} />
            <Metric label="Stablecoins" value={fmtUsd(defi.stablecoinMcapUsd)} sub="USD-pegged" />
            <Metric label="ETH gas" value={eth.gasGwei != null ? `${fmt(eth.gasGwei, 1)} gwei` : '—'} />
          </div>
        </Section>
        <Section title="Cross-chain fees">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric
              label="BTC fast"
              value={data.fees.btc?.fastest != null ? `${data.fees.btc.fastest} sat/vB` : '—'}
            />
            <Metric
              label="LTC fast"
              value={data.fees.ltc?.fastest != null ? `${data.fees.ltc.fastest} sat/vB` : '—'}
            />
            <Metric
              label="ETH gas"
              value={data.fees.ethGasGwei != null ? `${fmt(data.fees.ethGasGwei, 1)} gwei` : '—'}
            />
            <Metric
              label="ETH base"
              value={data.fees.ethBaseFeeGwei != null ? `${fmt(data.fees.ethBaseFeeGwei, 1)} gwei` : '—'}
            />
          </div>
        </Section>
        <Section title="Network snapshot">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="BTC height" value={fmtInt(btc?.height)} />
            <Metric
              label="BTC hashrate"
              value={btc?.hashrateEh != null ? `${fmt(btc.hashrateEh, 2)} EH/s` : '—'}
            />
            <Metric label="ETH block" value={fmtInt(eth.blockNumber)} />
            <Metric label="SOL epoch" value={fmtInt(sol.epoch)} />
            <Metric label="LTC height" value={fmtInt(ltc?.height)} />
            <Metric
              label="SOL slot"
              value={fmtInt(sol.slot)}
              sub={sol.epochProgressPct != null ? `epoch ${fmt(sol.epochProgressPct, 1)}%` : undefined}
            />
          </div>
        </Section>
        <Section title="Top chains TVL">
          <ul className="space-y-1">
            {defi.chains.slice(0, 6).map((c, i) => (
              <li key={c.name} className="flex items-center gap-2 text-[10px] px-1 py-0.5 rounded hover:bg-[#12161c]">
                <span className="text-[#5e6673] w-4">{i + 1}</span>
                <span className="flex-1 truncate text-[#eaecef]">{c.name}</span>
                <span className="font-mono-nums text-[#848e9c]">{fmtUsd(c.tvl)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </>
    )
  }

  if (tab === 'btc' && btc) return <UtxoNetworkView title="Bitcoin" unit="BTC" data={btc} />
  if (tab === 'btc')
    return <div className="text-terminal-muted py-4 text-center">BTC data unavailable</div>

  if (tab === 'ltc' && ltc) return <UtxoNetworkView title="Litecoin" unit="LTC" data={ltc} />
  if (tab === 'ltc')
    return <div className="text-terminal-muted py-4 text-center">LTC data unavailable</div>

  if (tab === 'eth') {
    return (
      <>
        <Section title="Execution layer">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric
              label="Gas price"
              value={eth.gasGwei != null ? `${fmt(eth.gasGwei, 2)} gwei` : '—'}
              tone={
                eth.gasGwei != null && eth.gasGwei > 50
                  ? 'warn'
                  : eth.gasGwei != null && eth.gasGwei < 15
                    ? 'up'
                    : 'neutral'
              }
            />
            <Metric
              label="Base fee"
              value={eth.baseFeeGwei != null ? `${fmt(eth.baseFeeGwei, 2)} gwei` : '—'}
            />
            <Metric label="Block #" value={fmtInt(eth.blockNumber)} />
            <Metric label="Ethereum TVL" value={fmtUsd(eth.tvlUsd)} />
            <Metric
              label="Share of DeFi"
              value={
                eth.tvlUsd != null && defi.totalTvlUsd != null && defi.totalTvlUsd > 0
                  ? `${((eth.tvlUsd / defi.totalTvlUsd) * 100).toFixed(1)}%`
                  : '—'
              }
            />
          </div>
        </Section>
        <p className="text-[9px] text-[#5e6673] leading-relaxed px-0.5">
          Gas via public Ethereum RPC. Use the Address tab to verify wallets / contracts.
        </p>
      </>
    )
  }

  if (tab === 'sol') {
    return (
      <>
        <Section title="Solana network">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="Epoch" value={fmtInt(sol.epoch)} />
            <Metric label="Absolute slot" value={fmtInt(sol.absoluteSlot)} />
            <Metric
              label="Epoch progress"
              value={sol.epochProgressPct != null ? `${fmt(sol.epochProgressPct, 2)}%` : '—'}
            />
            <Metric label="Tx count (epoch info)" value={fmtInt(sol.transactionCount)} />
            <Metric label="Solana TVL" value={fmtUsd(sol.tvlUsd)} />
          </div>
          <div className="mt-1.5">
            <Bar pct={sol.epochProgressPct} />
          </div>
        </Section>
      </>
    )
  }

  if (tab === 'alts') {
    return (
      <Section title="L1 / L2 TVL (DefiLlama)">
        <ul className="space-y-1">
          {alts.chains.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 text-[10px] px-1 py-0.5 rounded hover:bg-[#12161c]">
              <span className="text-[#5e6673] w-4">{i + 1}</span>
              <span className="text-[#f0b90b] w-10 font-mono">{c.id}</span>
              <span className="flex-1 truncate text-[#eaecef]">{c.name}</span>
              <span className="font-mono-nums text-[#848e9c]">{fmtUsd(c.tvlUsd)}</span>
            </li>
          ))}
        </ul>
      </Section>
    )
  }

  if (tab === 'defi') {
    return (
      <>
        <Section title="Totals">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="Total TVL" value={fmtUsd(defi.totalTvlUsd)} />
            <Metric label="Stablecoin mcap" value={fmtUsd(defi.stablecoinMcapUsd)} />
          </div>
        </Section>
        <Section title="Stablecoins">
          <ul className="space-y-0.5">
            {(defi.stablecoins ?? []).map((s) => (
              <li key={s.symbol} className="flex items-center gap-2 text-[10px] px-1 py-0.5">
                <span className="text-[#f0b90b] w-12 font-mono">{s.symbol}</span>
                <span className="flex-1 truncate text-[#848e9c]">{s.name}</span>
                <span className="font-mono-nums text-[#eaecef]">{fmtUsd(s.mcapUsd)}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Chains">
          <ul className="space-y-0.5">
            {defi.chains.map((c, i) => {
              const share =
                defi.totalTvlUsd && defi.totalTvlUsd > 0 ? (c.tvl / defi.totalTvlUsd) * 100 : null
              return (
                <li key={c.name} className="px-1 py-1 rounded hover:bg-[#12161c]">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-[#5e6673] w-4">{i + 1}</span>
                    <span className="flex-1 truncate text-[#eaecef]">{c.name}</span>
                    <span className="font-mono-nums text-[#848e9c]">{fmtUsd(c.tvl)}</span>
                    <span className="text-[#5e6673] w-12 text-right">
                      {share != null ? `${share.toFixed(1)}%` : ''}
                    </span>
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
              <li
                key={`${p.name}-${i}`}
                className="flex items-center gap-2 text-[10px] px-1 py-0.5 rounded hover:bg-[#12161c]"
              >
                <span className="text-[#5e6673] w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[#eaecef]">{p.name}</div>
                  <div className="text-[9px] text-[#5e6673] truncate">
                    {p.chain} · {p.category}
                    {p.change1d != null ? ` · 1d ${fmtPct(p.change1d)}` : ''}
                  </div>
                </div>
                <span className="font-mono-nums text-[#848e9c] shrink-0">{fmtUsd(p.tvl)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </>
    )
  }

  return null
}
