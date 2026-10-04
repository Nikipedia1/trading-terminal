/**
 * GET /api/onchain – aggregate real public on-chain metrics.
 * Sources: mempool.space (BTC), DefiLlama (DeFi/TVL/stablecoins),
 * public Ethereum RPC (gas). Cache ~45s. No synthetic/fake numbers.
 */

import { cors, json, bad, type Env } from './auth/_shared'

const UA =
  'Mozilla/5.0 (compatible; TradingTerminalOnchain/1.0; +https://github.com/Nikipedia1/trading-terminal)'

const CACHE_TTL_MS = 45_000
let cache: { at: number; body: OnchainResponse } | null = null

interface OnchainResponse {
  updatedAt: number
  cacheTtlMs: number
  warnings: string[]
  btc: {
    height: number | null
    hashrateEh: number | null
    difficulty: number | null
    difficultyProgressPct: number | null
    difficultyChangePct: number | null
    estimatedRetargetDate: number | null
    remainingBlocks: number | null
    mempoolTxCount: number | null
    mempoolVsize: number | null
    fees: {
      fastest: number | null
      halfHour: number | null
      hour: number | null
      economy: number | null
      minimum: number | null
    }
    lightning: {
      channelCount: number | null
      nodeCount: number | null
      totalCapacityBtc: number | null
    } | null
  }
  eth: {
    gasGwei: number | null
    baseFeeGwei: number | null
    tvlUsd: number | null
  }
  defi: {
    totalTvlUsd: number | null
    chains: Array<{ name: string; tvl: number }>
    stablecoinMcapUsd: number | null
    topProtocols: Array<{ name: string; chain: string; tvl: number; category: string }>
  }
  market: {
    fearGreed: number | null
    fearGreedLabel: string | null
  }
  sources: string[]
}

async function fetchJson<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
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

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
      return json(
        { ...cache.body, cached: true },
        200,
        ctx.request,
        { 'Cache-Control': `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}` }
      )
    }

    const warnings: string[] = []
    const sources: string[] = []

    const [fees, diffAdj, mempool, height, hashrate, lightning] = await Promise.all([
      safe(
        'mempool.fees',
        () =>
          fetchJson<{
            fastestFee: number
            halfHourFee: number
            hourFee: number
            economyFee: number
            minimumFee: number
          }>('https://mempool.space/api/v1/fees/recommended'),
        warnings
      ),
      safe(
        'mempool.difficulty',
        () =>
          fetchJson<{
            progressPercent: number
            difficultyChange: number
            estimatedRetargetDate: number
            remainingBlocks: number
          }>('https://mempool.space/api/v1/difficulty-adjustment'),
        warnings
      ),
      safe(
        'mempool.mempool',
        () =>
          fetchJson<{ count: number; vsize: number }>('https://mempool.space/api/mempool'),
        warnings
      ),
      safe(
        'mempool.height',
        async () => {
          const res = await fetch('https://mempool.space/api/blocks/tip/height', {
            headers: { 'User-Agent': UA },
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return Number(await res.text())
        },
        warnings
      ),
      safe(
        'mempool.hashrate',
        () =>
          fetchJson<{
            currentHashrate: number
            currentDifficulty: number
          }>('https://mempool.space/api/v1/mining/hashrate/3d'),
        warnings
      ),
      safe(
        'mempool.lightning',
        () =>
          fetchJson<{
            latest: {
              channel_count: number
              node_count: number
              total_capacity: number
            }
          }>('https://mempool.space/api/v1/lightning/statistics/latest'),
        warnings
      ),
    ])

    if (fees || diffAdj || mempool || height != null || hashrate) {
      sources.push('mempool.space')
    }

    const hashrateEh =
      hashrate?.currentHashrate != null
        ? hashrate.currentHashrate / 1e18
        : null

    const btc = {
      height: num(height),
      hashrateEh: hashrateEh != null && Number.isFinite(hashrateEh) ? hashrateEh : null,
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
    }

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
    if (gasRaw != null) sources.push('publicnode.com')

    const baseFeeRaw = await safe(
      'eth.baseFee',
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
        const j = (await res.json()) as { result?: { baseFeePerGas?: string } }
        const hex = j.result?.baseFeePerGas
        if (!hex) return null
        return parseInt(hex, 16) / 1e9
      },
      warnings
    )

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
    const ethChain = sortedChains.find(
      (c) => c.name === 'Ethereum' || c.gecko_id === 'ethereum'
    )

    const stables = await safe(
      'llama.stablecoins',
      () =>
        fetchJson<{
          peggedAssets?: Array<{
            circulating?: { peggedUSD?: number }
          }>
        }>('https://stablecoins.llama.fi/stablecoins?includePrices=true'),
      warnings
    )

    let stablecoinMcapUsd: number | null = null
    if (stables?.peggedAssets) {
      stablecoinMcapUsd = stables.peggedAssets.reduce((s, a) => {
        const v = a.circulating?.peggedUSD
        return s + (Number.isFinite(v) ? (v as number) : 0)
      }, 0)
      if (!sources.includes('DefiLlama')) sources.push('DefiLlama')
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
          }>
        >('https://api.llama.fi/protocols'),
      warnings
    )

    const topProtocols = (protocols ?? [])
      .filter((p) => Number.isFinite(p.tvl) && (p.tvl as number) > 0)
      .sort((a, b) => (b.tvl as number) - (a.tvl as number))
      .slice(0, 8)
      .map((p) => ({
        name: p.name,
        chain: p.chain || p.chains?.[0] || '—',
        tvl: p.tvl as number,
        category: p.category || '—',
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

    const body: OnchainResponse = {
      updatedAt: Date.now(),
      cacheTtlMs: CACHE_TTL_MS,
      warnings,
      btc,
      eth: {
        gasGwei: gasRaw,
        baseFeeGwei: baseFeeRaw,
        tvlUsd: ethChain?.tvl ?? null,
      },
      defi: {
        totalTvlUsd,
        chains: sortedChains.slice(0, 10).map((c) => ({ name: c.name, tvl: c.tvl })),
        stablecoinMcapUsd,
        topProtocols,
      },
      market: {
        fearGreed: fng?.data?.[0]?.value != null ? Number(fng.data[0].value) : null,
        fearGreedLabel: fng?.data?.[0]?.value_classification ?? null,
      },
      sources,
    }

    const hasData =
      btc.height != null ||
      btc.hashrateEh != null ||
      btc.fees.fastest != null ||
      totalTvlUsd != null ||
      gasRaw != null

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
      { 'Cache-Control': `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}` }
    )
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'onchain failed', 502, ctx.request)
  }
}
