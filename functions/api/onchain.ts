/**
 * GET /api/onchain – professional multi-chain on-chain metrics (real public APIs only).
 * BTC (mempool.space), LTC (litecoinspace), ETH (public RPC), SOL (public RPC),
 * DeFi/stablecoins (DefiLlama), Fear&Greed. Cache ~45s. No synthetic numbers.
 */

import { cors, json, bad, type Env } from './auth/_shared'

const UA =
  'Mozilla/5.0 (compatible; TradingTerminalOnchain/2.0; +https://github.com/Nikipedia1/trading-terminal)'

const CACHE_TTL_MS = 45_000
let cache: { at: number; body: Record<string, unknown> } | null = null

async function fetchJson<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`${url.split('?')[0]} → HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

async function safe<T>(
  label: string,
  fn: () => Promise<T>,
  warnings: string[]
): Promise<T | null> {
  try {
    return await fn()
  } catch (e) {
    warnings.push(`${label}: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

type FeeBoard = {
  fastest: number | null
  halfHour: number | null
  hour: number | null
  economy: number | null
  minimum: number | null
}

async function mempoolFamily(
  base: string,
  warnings: string[],
  label: string
): Promise<{
  height: number | null
  hashrateEh: number | null
  difficulty: number | null
  difficultyProgressPct: number | null
  difficultyChangePct: number | null
  estimatedRetargetDate: number | null
  remainingBlocks: number | null
  mempoolTxCount: number | null
  mempoolVsize: number | null
  fees: FeeBoard
  lightning: {
    channelCount: number | null
    nodeCount: number | null
    totalCapacityBtc: number | null
  } | null
  pools: Array<{ name: string; blockCount: number; sharePct: number }>
} | null> {
  const [fees, diffAdj, mempool, height, hashrate, lightning, pools] =
    await Promise.all([
      safe(
        `${label}.fees`,
        () =>
          fetchJson<{
            fastestFee: number
            halfHourFee: number
            hourFee: number
            economyFee: number
            minimumFee: number
          }>(`${base}/v1/fees/recommended`),
        warnings
      ),
      safe(
        `${label}.difficulty`,
        () =>
          fetchJson<{
            progressPercent: number
            difficultyChange: number
            estimatedRetargetDate: number
            remainingBlocks: number
          }>(`${base}/v1/difficulty-adjustment`),
        warnings
      ),
      safe(
        `${label}.mempool`,
        () => fetchJson<{ count: number; vsize: number }>(`${base}/mempool`),
        warnings
      ),
      safe(
        `${label}.height`,
        async () => {
          const res = await fetch(`${base}/blocks/tip/height`, {
            headers: { 'User-Agent': UA },
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return Number(await res.text())
        },
        warnings
      ),
      safe(
        `${label}.hashrate`,
        () =>
          fetchJson<{ currentHashrate: number; currentDifficulty: number }>(
            `${base}/v1/mining/hashrate/3d`
          ),
        warnings
      ),
      safe(
        `${label}.lightning`,
        () =>
          fetchJson<{
            latest: {
              channel_count: number
              node_count: number
              total_capacity: number
            }
          }>(`${base}/v1/lightning/statistics/latest`),
        warnings
      ),
      safe(
        `${label}.pools`,
        () =>
          fetchJson<{
            pools: Array<{ name: string; blockCount: number; share?: number }>
          }>(`${base}/v1/mining/pools/1w`),
        warnings
      ),
    ])

  const hasAny =
    fees || diffAdj || mempool || height != null || hashrate || pools
  if (!hasAny) return null

  const hashrateEh =
    hashrate?.currentHashrate != null
      ? hashrate.currentHashrate / 1e18
      : null

  const poolList = (pools?.pools ?? [])
    .map((p) => ({
      name: p.name,
      blockCount: p.blockCount,
      sharePct: p.share != null ? p.share * 100 : 0,
    }))
    .slice(0, 8)

  const maxShare = Math.max(0, ...poolList.map((p) => p.sharePct))
  const normalizedPools =
    maxShare > 0 && maxShare <= 1.5
      ? poolList.map((p) => ({ ...p, sharePct: p.sharePct * 100 }))
      : poolList

  return {
    height: num(height),
    hashrateEh:
      hashrateEh != null && Number.isFinite(hashrateEh) ? hashrateEh : null,
    difficulty: num(hashrate?.currentDifficulty),
    difficultyProgressPct: num(diffAdj?.progressPercent),
    difficultyChangePct: num(diffAdj?.difficultyChange),
    estimatedRetargetDate: num(diffAdj?.estimatedRetargetDate),
    remainingBlocks: num(diffAdj?.remainingBlocks),
    mempoolTxCount: num(mempool?.count),
    mempoolVsize: num(mempool?.vsize),
    fees: {
      fastest: num(fees?.fastestFee),
      halfHour: num(fees?.halfHourFee),
      hour: num(fees?.hourFee),
      economy: num(fees?.economyFee),
      minimum: num(fees?.minimumFee),
    },
    lightning: lightning?.latest
      ? {
          channelCount: num(lightning.latest.channel_count),
          nodeCount: num(lightning.latest.node_count),
          totalCapacityBtc:
            lightning.latest.total_capacity != null
              ? lightning.latest.total_capacity / 1e8
              : null,
        }
      : null,
    pools: normalizedPools.filter((p) => p.blockCount > 0),
  }
}

async function ethMetrics(warnings: string[]) {
  const gasRaw = await safe(
    'eth.gas',
    async () => {
      const res = await fetch('https://ethereum.publicnode.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_gasPrice',
          params: [],
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json()) as { result?: string }
      if (!j.result) throw new Error('no result')
      return parseInt(j.result, 16) / 1e9
    },
    warnings
  )

  const block = await safe(
    'eth.block',
    async () => {
      const res = await fetch('https://ethereum.publicnode.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'eth_getBlockByNumber',
          params: ['latest', false],
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json()) as {
        result?: { baseFeePerGas?: string; number?: string }
      }
      const base = j.result?.baseFeePerGas
        ? parseInt(j.result.baseFeePerGas, 16) / 1e9
        : null
      const numBlock = j.result?.number
        ? parseInt(j.result.number, 16)
        : null
      return { base, numBlock }
    },
    warnings
  )

  return {
    gasGwei: gasRaw,
    baseFeeGwei: block?.base ?? null,
    blockNumber: block?.numBlock ?? null,
    tvlUsd: null as number | null,
  }
}

async function solMetrics(warnings: string[]) {
  const epochInfo = await safe(
    'sol.epoch',
    async () => {
      const res = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getEpochInfo',
          params: [],
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json()) as {
        result?: {
          absoluteSlot: number
          slotIndex: number
          slotsInEpoch: number
          epoch: number
          transactionCount?: number
        }
      }
      return j.result ?? null
    },
    warnings
  )

  if (!epochInfo) {
    return {
      slot: null,
      epoch: null,
      absoluteSlot: null,
      transactionCount: null,
      epochProgressPct: null,
    }
  }

  const progress =
    epochInfo.slotsInEpoch > 0
      ? (epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100
      : null

  return {
    slot: num(epochInfo.absoluteSlot),
    epoch: num(epochInfo.epoch),
    absoluteSlot: num(epochInfo.absoluteSlot),
    transactionCount: num(epochInfo.transactionCount),
    epochProgressPct: progress,
  }
}

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
      return json(
        { ...cache.body, cached: true },
        200,
        ctx.request,
        {
          'Cache-Control': `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
        }
      )
    }

    const warnings: string[] = []
    const sources: string[] = []

    const [btc, ltc, eth, sol] = await Promise.all([
      mempoolFamily('https://mempool.space/api', warnings, 'btc'),
      mempoolFamily('https://litecoinspace.org/api', warnings, 'ltc'),
      ethMetrics(warnings),
      solMetrics(warnings),
    ])

    if (btc) sources.push('mempool.space')
    if (ltc) sources.push('litecoinspace.org')
    if (eth.gasGwei != null || eth.blockNumber != null)
      sources.push('publicnode.com')
    if (sol.slot != null) sources.push('solana mainnet RPC')

    const chains = await safe(
      'llama.chains',
      () =>
        fetchJson<Array<{ name: string; tvl: number; gecko_id?: string }>>(
          'https://api.llama.fi/v2/chains'
        ),
      warnings
    )
    if (chains) sources.push('DefiLlama')

    const sortedChains = (chains ?? [])
      .filter((c) => Number.isFinite(c.tvl) && c.tvl > 0)
      .sort((a, b) => b.tvl - a.tvl)

    const totalTvlUsd = sortedChains.reduce((s, c) => s + c.tvl, 0) || null
    const findChain = (...names: string[]) =>
      sortedChains.find((c) =>
        names.some((n) => c.name.toLowerCase() === n.toLowerCase())
      )

    const ethChain = findChain('Ethereum')
    const solChain = findChain('Solana')
    const btcChain = findChain('Bitcoin')
    const avaxChain = findChain('Avalanche')
    const arbChain = findChain('Arbitrum')
    const baseChain = findChain('Base')
    const polygonChain = findChain('Polygon')
    const opChain = findChain('Optimism')
    const trxChain = findChain('Tron')
    const bscChain = findChain('BSC', 'Binance')

    if (ethChain) eth.tvlUsd = ethChain.tvl

    const stables = await safe(
      'llama.stablecoins',
      () =>
        fetchJson<{
          peggedAssets?: Array<{
            name: string
            symbol: string
            circulating?: { peggedUSD?: number }
          }>
        }>('https://stablecoins.llama.fi/stablecoins?includePrices=true'),
      warnings
    )

    let stablecoinMcapUsd: number | null = null
    const stableTop: Array<{ symbol: string; name: string; mcapUsd: number }> =
      []
    if (stables?.peggedAssets) {
      for (const a of stables.peggedAssets) {
        const v = a.circulating?.peggedUSD
        if (Number.isFinite(v) && (v as number) > 0) {
          stableTop.push({
            symbol: a.symbol || a.name,
            name: a.name,
            mcapUsd: v as number,
          })
        }
      }
      stableTop.sort((a, b) => b.mcapUsd - a.mcapUsd)
      stablecoinMcapUsd = stableTop.reduce((s, a) => s + a.mcapUsd, 0)
    }

    const protocols = await safe(
      'llama.protocols',
      () =>
        fetchJson<
          Array<{
            name: string
            chain?: string
            chains?: string[]
            tvl?: number
            category?: string
            change_1d?: number
          }>
        >('https://api.llama.fi/protocols'),
      warnings
    )

    const topProtocols = (protocols ?? [])
      .filter((p) => Number.isFinite(p.tvl) && (p.tvl as number) > 0)
      .sort((a, b) => (b.tvl as number) - (a.tvl as number))
      .slice(0, 12)
      .map((p) => ({
        name: p.name,
        chain: p.chain || p.chains?.[0] || '—',
        tvl: p.tvl as number,
        category: p.category || '—',
        change1d: num(p.change_1d),
      }))

    const fng = await safe(
      'fng',
      () =>
        fetchJson<{
          data?: Array<{ value: string; value_classification?: string }>
        }>('https://api.alternative.me/fng/?limit=1'),
      warnings
    )
    if (fng) sources.push('alternative.me')

    const body = {
      updatedAt: Date.now(),
      cacheTtlMs: CACHE_TTL_MS,
      warnings,
      sources,
      btc: btc ? { ...btc, tvlUsd: btcChain?.tvl ?? null } : null,
      ltc,
      eth: { ...eth, tvlUsd: ethChain?.tvl ?? null },
      sol: { ...sol, tvlUsd: solChain?.tvl ?? null },
      alts: {
        chains: [
          { id: 'AVAX', name: 'Avalanche', tvlUsd: avaxChain?.tvl ?? null },
          { id: 'ARB', name: 'Arbitrum', tvlUsd: arbChain?.tvl ?? null },
          { id: 'BASE', name: 'Base', tvlUsd: baseChain?.tvl ?? null },
          { id: 'MATIC', name: 'Polygon', tvlUsd: polygonChain?.tvl ?? null },
          { id: 'OP', name: 'Optimism', tvlUsd: opChain?.tvl ?? null },
          { id: 'TRX', name: 'Tron', tvlUsd: trxChain?.tvl ?? null },
          { id: 'BSC', name: 'BSC', tvlUsd: bscChain?.tvl ?? null },
          { id: 'SOL', name: 'Solana', tvlUsd: solChain?.tvl ?? null },
          { id: 'ETH', name: 'Ethereum', tvlUsd: ethChain?.tvl ?? null },
          { id: 'BTC', name: 'Bitcoin', tvlUsd: btcChain?.tvl ?? null },
        ].filter((c) => c.tvlUsd != null),
      },
      defi: {
        totalTvlUsd,
        chains: sortedChains.slice(0, 15).map((c) => ({
          name: c.name,
          tvl: c.tvl,
        })),
        stablecoinMcapUsd,
        stablecoins: stableTop.slice(0, 10),
        topProtocols,
      },
      market: {
        fearGreed:
          fng?.data?.[0]?.value != null ? Number(fng.data[0].value) : null,
        fearGreedLabel: fng?.data?.[0]?.value_classification ?? null,
      },
      fees: {
        btc: btc?.fees ?? null,
        ltc: ltc?.fees ?? null,
        ethGasGwei: eth.gasGwei,
        ethBaseFeeGwei: eth.baseFeeGwei,
      },
    }

    const hasData =
      btc != null ||
      eth.gasGwei != null ||
      totalTvlUsd != null ||
      sol.slot != null

    if (!hasData) {
      return bad(
        warnings.length
          ? `all upstreams failed: ${warnings.join('; ')}`
          : 'no on-chain data',
        502,
        ctx.request
      )
    }

    cache = { at: Date.now(), body }
    return json(
      { ...body, cached: false },
      200,
      ctx.request,
      {
        'Cache-Control': `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
      }
    )
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'onchain failed', 502, ctx.request)
  }
}
