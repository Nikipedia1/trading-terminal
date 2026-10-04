/** Unified on-chain snapshot from GET /api/onchain (real upstreams only). */

export interface OnchainFees {
  fastest: number | null
  halfHour: number | null
  hour: number | null
  economy: number | null
  minimum: number | null
}

export interface OnchainLightning {
  channelCount: number | null
  nodeCount: number | null
  totalCapacityBtc: number | null
}

export interface OnchainBtc {
  height: number | null
  hashrateEh: number | null
  difficulty: number | null
  difficultyProgressPct: number | null
  difficultyChangePct: number | null
  estimatedRetargetDate: number | null
  remainingBlocks: number | null
  mempoolTxCount: number | null
  mempoolVsize: number | null
  fees: OnchainFees
  lightning: OnchainLightning | null
}

export interface OnchainEth {
  gasGwei: number | null
  baseFeeGwei: number | null
  tvlUsd: number | null
}

export interface OnchainDefi {
  totalTvlUsd: number | null
  chains: Array<{ name: string; tvl: number }>
  stablecoinMcapUsd: number | null
  topProtocols: Array<{
    name: string
    chain: string
    tvl: number
    category: string
  }>
}

export interface OnchainMarket {
  fearGreed: number | null
  fearGreedLabel: string | null
}

export interface OnchainSnapshot {
  updatedAt: number
  cacheTtlMs: number
  warnings: string[]
  btc: OnchainBtc
  eth: OnchainEth
  defi: OnchainDefi
  market: OnchainMarket
  sources: string[]
  cached?: boolean
}

export type OnchainTab = 'overview' | 'btc' | 'eth' | 'defi'
