/**
 * GET /api/onchain/address?chain=btc|ltc|eth|sol&address=...
 * Real balance / activity lookup. Validates format server-side.
 * No synthetic data.
 */

import { cors, json, bad, type Env } from '../auth/_shared'

const UA =
  'Mozilla/5.0 (compatible; TradingTerminalOnchain/2.0; +https://github.com/Nikipedia1/trading-terminal)'

type Chain = 'btc' | 'ltc' | 'eth' | 'sol'

function detectChain(address: string): Chain | null {
  const a = address.trim()
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return 'eth'
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a)) return 'btc'
  if (/^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a)) return 'ltc'
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) && !a.startsWith('bc1') && !a.startsWith('ltc1'))
    return 'sol'
  return null
}

function validate(chain: Chain, address: string): string | null {
  const a = address.trim()
  if (chain === 'eth' && !/^0x[a-fA-F0-9]{40}$/.test(a))
    return 'Invalid Ethereum address (expect 0x + 40 hex)'
  if (chain === 'btc' && !/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a))
    return 'Invalid Bitcoin address'
  if (chain === 'ltc' && !/^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a))
    return 'Invalid Litecoin address'
  if (chain === 'sol' && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a))
    return 'Invalid Solana address (base58)'
  return null
}

async function lookupBtcFamily(base: string, address: string, unit: 'BTC' | 'LTC') {
  const res = await fetch(`${base}/address/${encodeURIComponent(address)}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  })
  if (res.status === 400 || res.status === 404) {
    throw new Error(`Address not found or invalid (${res.status})`)
  }
  if (!res.ok) throw new Error(`explorer HTTP ${res.status}`)
  const j = (await res.json()) as {
    address: string
    chain_stats?: {
      funded_txo_sum?: number
      spent_txo_sum?: number
      tx_count?: number
    }
    mempool_stats?: {
      funded_txo_sum?: number
      spent_txo_sum?: number
      tx_count?: number
    }
  }
  const cs = j.chain_stats ?? {}
  const ms = j.mempool_stats ?? {}
  const confirmed = ((cs.funded_txo_sum ?? 0) - (cs.spent_txo_sum ?? 0)) / 1e8
  const mempool = ((ms.funded_txo_sum ?? 0) - (ms.spent_txo_sum ?? 0)) / 1e8
  return {
    address: j.address || address,
    balance: confirmed,
    balanceMempool: mempool,
    totalReceived: (cs.funded_txo_sum ?? 0) / 1e8,
    totalSent: (cs.spent_txo_sum ?? 0) / 1e8,
    txCount: cs.tx_count ?? 0,
    mempoolTxCount: ms.tx_count ?? 0,
    unit,
    explorer: base.includes('litecoin')
      ? `https://litecoinspace.org/address/${address}`
      : `https://mempool.space/address/${address}`,
  }
}

async function lookupEth(address: string) {
  const rpc = 'https://ethereum.publicnode.com'
  const call = async (method: string, params: unknown[]) => {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`)
    const j = (await res.json()) as { result?: string; error?: { message: string } }
    if (j.error) throw new Error(j.error.message)
    return j.result
  }
  const [balHex, nonceHex, code] = await Promise.all([
    call('eth_getBalance', [address.toLowerCase(), 'latest']),
    call('eth_getTransactionCount', [address.toLowerCase(), 'latest']),
    call('eth_getCode', [address.toLowerCase(), 'latest']),
  ])
  const balanceWei = balHex ? BigInt(balHex) : 0n
  const balance = Number(balanceWei) / 1e18
  const nonce = nonceHex ? parseInt(nonceHex, 16) : 0
  const isContract = !!(code && code !== '0x' && code !== '0x0')
  return {
    address: address.toLowerCase(),
    balance,
    balanceMempool: null as number | null,
    totalReceived: null as number | null,
    totalSent: null as number | null,
    txCount: nonce,
    mempoolTxCount: 0,
    unit: 'ETH' as const,
    isContract,
    explorer: `https://etherscan.io/address/${address}`,
  }
}

async function lookupSol(address: string) {
  const res = await fetch('https://api.mainnet-beta.solana.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address],
    }),
  })
  if (!res.ok) throw new Error(`SOL RPC HTTP ${res.status}`)
  const j = (await res.json()) as {
    result?: { value: number }
    error?: { message: string }
  }
  if (j.error) throw new Error(j.error.message)
  const lamports = j.result?.value ?? 0
  let txCount: number | null = null
  try {
    const res2 = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'getSignaturesForAddress',
        params: [address, { limit: 1 }],
      }),
    })
    if (res2.ok) {
      const j2 = (await res2.json()) as { result?: unknown[] }
      txCount = Array.isArray(j2.result) ? (j2.result.length > 0 ? -1 : 0) : null
    }
  } catch {
    /* optional */
  }
  return {
    address,
    balance: lamports / 1e9,
    balanceMempool: null as number | null,
    totalReceived: null as number | null,
    totalSent: null as number | null,
    txCount,
    mempoolTxCount: 0,
    unit: 'SOL' as const,
    explorer: `https://solscan.io/account/${address}`,
  }
}

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const url = new URL(ctx.request.url)
    const rawAddr = (url.searchParams.get('address') || '').trim()
    let chain = (url.searchParams.get('chain') || '').toLowerCase() as Chain | ''

    if (!rawAddr || rawAddr.length < 26 || rawAddr.length > 128) {
      return bad('address required (26–128 chars)', 400, ctx.request)
    }

    if (!chain) {
      const detected = detectChain(rawAddr)
      if (!detected) {
        return bad('could not detect chain – pass chain=btc|ltc|eth|sol', 400, ctx.request)
      }
      chain = detected
    }

    if (!['btc', 'ltc', 'eth', 'sol'].includes(chain)) {
      return bad('chain must be btc|ltc|eth|sol', 400, ctx.request)
    }

    const verr = validate(chain as Chain, rawAddr)
    if (verr) return bad(verr, 400, ctx.request)

    let result: Record<string, unknown>
    if (chain === 'btc') {
      result = await lookupBtcFamily('https://mempool.space/api', rawAddr, 'BTC')
    } else if (chain === 'ltc') {
      result = await lookupBtcFamily('https://litecoinspace.org/api', rawAddr, 'LTC')
    } else if (chain === 'eth') {
      result = await lookupEth(rawAddr)
    } else {
      result = await lookupSol(rawAddr)
    }

    return json(
      {
        ok: true,
        chain,
        detected: detectChain(rawAddr),
        validFormat: true,
        ...result,
        fetchedAt: Date.now(),
      },
      200,
      ctx.request,
      { 'Cache-Control': 'public, max-age=15' }
    )
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'lookup failed', 502, ctx.request)
  }
}
