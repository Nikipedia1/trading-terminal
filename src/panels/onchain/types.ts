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

export interface MiningPool {
  name: string
  blockCount: number
  sharePct: number
}

export interface UtxoChainStats {
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
  pools: MiningPool[]
  tvlUsd?: number | null
}

export interface OnchainEth {
  gasGwei: number | null
  baseFeeGwei: number | null
  blockNumber: number | null
  tvlUsd: number | null
}

export interface OnchainSol {
  slot: number | null
  epoch: number | null
  absoluteSlot: number | null
  transactionCount: number | null
  epochProgressPct: number | null
  tvlUsd: number | null
}

export interface OnchainDefi {
  totalTvlUsd: number | null
  chains: Array<{ name: string; tvl: number }>
  stablecoinMcapUsd: number | null
  stablecoins: Array<{ symbol: string; name: string; mcapUsd: number }>
  topProtocols: Array<{
    name: string
    chain: string
    tvl: number
    category: string
    change1d: number | null
  }>
}

export interface OnchainMarket {
  fearGreed: number | null
  fearGreedLabel: string | null
}

export interface OnchainAlts {
  chains: Array<{ id: string; name: string; tvlUsd: number | null }>
}

export interface OnchainSnapshot {
  updatedAt: number
  cacheTtlMs: number
  warnings: string[]
  sources: string[]
  btc: UtxoChainStats | null
  ltc: UtxoChainStats | null
  eth: OnchainEth
  sol: OnchainSol
  alts: OnchainAlts
  defi: OnchainDefi
  market: OnchainMarket
  fees: {
    btc: OnchainFees | null
    ltc: OnchainFees | null
    ethGasGwei: number | null
    ethBaseFeeGwei: number | null
  }
  cached?: boolean
}

export type OnchainTab =
  | 'overview'
  | 'btc'
  | 'eth'
  | 'sol'
  | 'ltc'
  | 'alts'
  | 'defi'
  | 'address'

export type AddressChain = 'btc' | 'ltc' | 'eth' | 'sol' | 'auto'

export interface AddressLookupResult {
  ok: boolean
  chain: string
  detected?: string | null
  validFormat: boolean
  address: string
  balance: number
  balanceMempool?: number | null
  totalReceived?: number | null
  totalSent?: number | null
  txCount: number | null
  mempoolTxCount?: number
  unit: string
  isContract?: boolean
  explorer?: string
  fetchedAt: number
  error?: string
}
