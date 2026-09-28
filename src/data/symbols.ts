/**
 * Liquid crypto instruments – Binance-style symbols (BASEUSDT).
 * KuCoin / OKX / Bybit clients normalize format per exchange.
 * User can still type any valid symbol in the input.
 */

export type SymbolGroup =
  | 'Major'
  | 'L1'
  | 'L2'
  | 'DeFi'
  | 'AI'
  | 'Meme'
  | 'Gaming'
  | 'RWA'
  | 'Exchange'
  | 'Payments'
  | 'Infra'
  | 'Other'

export interface SymbolPreset {
  symbol: string
  label: string
  group: SymbolGroup
  /** Optional display name */
  name?: string
}

export const SYMBOL_GROUPS: SymbolGroup[] = [
  'Major',
  'L1',
  'L2',
  'DeFi',
  'AI',
  'Meme',
  'Gaming',
  'RWA',
  'Exchange',
  'Payments',
  'Infra',
  'Other',
]

/** Binance-style symbols (no dash). */
export const SYMBOL_PRESETS: SymbolPreset[] = [
  // ── Major ──────────────────────────────────────────────
  { symbol: 'BTCUSDT', label: 'BTC', group: 'Major', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', label: 'ETH', group: 'Major', name: 'Ethereum' },
  { symbol: 'BNBUSDT', label: 'BNB', group: 'Major', name: 'BNB' },
  { symbol: 'SOLUSDT', label: 'SOL', group: 'Major', name: 'Solana' },
  { symbol: 'XRPUSDT', label: 'XRP', group: 'Major', name: 'XRP' },
  { symbol: 'ADAUSDT', label: 'ADA', group: 'Major', name: 'Cardano' },
  { symbol: 'DOGEUSDT', label: 'DOGE', group: 'Major', name: 'Dogecoin' },
  { symbol: 'AVAXUSDT', label: 'AVAX', group: 'Major', name: 'Avalanche' },
  { symbol: 'DOTUSDT', label: 'DOT', group: 'Major', name: 'Polkadot' },
  { symbol: 'LINKUSDT', label: 'LINK', group: 'Major', name: 'Chainlink' },
  { symbol: 'TRXUSDT', label: 'TRX', group: 'Major', name: 'TRON' },
  { symbol: 'TONUSDT', label: 'TON', group: 'Major', name: 'Toncoin' },
  { symbol: 'LTCUSDT', label: 'LTC', group: 'Major', name: 'Litecoin' },
  { symbol: 'BCHUSDT', label: 'BCH', group: 'Major', name: 'Bitcoin Cash' },
  { symbol: 'ATOMUSDT', label: 'ATOM', group: 'Major', name: 'Cosmos' },
  { symbol: 'NEARUSDT', label: 'NEAR', group: 'Major', name: 'NEAR' },

  // ── L1 ─────────────────────────────────────────────────
  { symbol: 'APTUSDT', label: 'APT', group: 'L1', name: 'Aptos' },
  { symbol: 'SUIUSDT', label: 'SUI', group: 'L1', name: 'Sui' },
  { symbol: 'SEIUSDT', label: 'SEI', group: 'L1', name: 'Sei' },
  { symbol: 'INJUSDT', label: 'INJ', group: 'L1', name: 'Injective' },
  { symbol: 'TIAUSDT', label: 'TIA', group: 'L1', name: 'Celestia' },
  { symbol: 'ICPUSDT', label: 'ICP', group: 'L1', name: 'Internet Computer' },
  { symbol: 'HBARUSDT', label: 'HBAR', group: 'L1', name: 'Hedera' },
  { symbol: 'ALGOUSDT', label: 'ALGO', group: 'L1', name: 'Algorand' },
  { symbol: 'FTMUSDT', label: 'FTM', group: 'L1', name: 'Fantom' },
  { symbol: 'EGLDUSDT', label: 'EGLD', group: 'L1', name: 'MultiversX' },
  { symbol: 'KASUSDT', label: 'KAS', group: 'L1', name: 'Kaspa' },
  { symbol: 'VETUSDT', label: 'VET', group: 'L1', name: 'VeChain' },
  { symbol: 'XTZUSDT', label: 'XTZ', group: 'L1', name: 'Tezos' },
  { symbol: 'FLOWUSDT', label: 'FLOW', group: 'L1', name: 'Flow' },
  { symbol: 'MINAUSDT', label: 'MINA', group: 'L1', name: 'Mina' },
  { symbol: 'ROSEUSDT', label: 'ROSE', group: 'L1', name: 'Oasis' },
  { symbol: 'CFXUSDT', label: 'CFX', group: 'L1', name: 'Conflux' },
  { symbol: 'CKBUSDT', label: 'CKB', group: 'L1', name: 'Nervos' },
  { symbol: 'ZENUSDT', label: 'ZEN', group: 'L1', name: 'Horizen' },
  { symbol: 'ZILUSDT', label: 'ZIL', group: 'L1', name: 'Zilliqa' },

  // ── L2 / scaling ───────────────────────────────────────
  { symbol: 'MATICUSDT', label: 'MATIC', group: 'L2', name: 'Polygon' },
  { symbol: 'POLUSDT', label: 'POL', group: 'L2', name: 'POL' },
  { symbol: 'OPUSDT', label: 'OP', group: 'L2', name: 'Optimism' },
  { symbol: 'ARBUSDT', label: 'ARB', group: 'L2', name: 'Arbitrum' },
  { symbol: 'STRKUSDT', label: 'STRK', group: 'L2', name: 'Starknet' },
  { symbol: 'MANTAUSDT', label: 'MANTA', group: 'L2', name: 'Manta' },
  { symbol: 'METISUSDT', label: 'METIS', group: 'L2', name: 'Metis' },
  { symbol: 'LRCUSDT', label: 'LRC', group: 'L2', name: 'Loopring' },
  { symbol: 'IMXUSDT', label: 'IMX', group: 'L2', name: 'Immutable X' },
  { symbol: 'ZKUSDT', label: 'ZK', group: 'L2', name: 'zkSync' },
  { symbol: 'BLASTUSDT', label: 'BLAST', group: 'L2', name: 'Blast' },
  { symbol: 'SCROLLUSDT', label: 'SCROLL', group: 'L2', name: 'Scroll' },
  { symbol: 'TAIKOUSDT', label: 'TAIKO', group: 'L2', name: 'Taiko' },
  { symbol: 'ALTUSDT', label: 'ALT', group: 'L2', name: 'AltLayer' },

  // ── DeFi ───────────────────────────────────────────────
  { symbol: 'UNIUSDT', label: 'UNI', group: 'DeFi', name: 'Uniswap' },
  { symbol: 'AAVEUSDT', label: 'AAVE', group: 'DeFi', name: 'Aave' },
  { symbol: 'MKRUSDT', label: 'MKR', group: 'DeFi', name: 'Maker' },
  { symbol: 'LDOUSDT', label: 'LDO', group: 'DeFi', name: 'Lido' },
  { symbol: 'CRVUSDT', label: 'CRV', group: 'DeFi', name: 'Curve' },
  { symbol: 'PENDLEUSDT', label: 'PENDLE', group: 'DeFi', name: 'Pendle' },
  { symbol: 'COMPUSDT', label: 'COMP', group: 'DeFi', name: 'Compound' },
  { symbol: 'SNXUSDT', label: 'SNX', group: 'DeFi', name: 'Synthetix' },
  { symbol: 'SUSHIUSDT', label: 'SUSHI', group: 'DeFi', name: 'SushiSwap' },
  { symbol: '1INCHUSDT', label: '1INCH', group: 'DeFi', name: '1inch' },
  { symbol: 'DYDXUSDT', label: 'DYDX', group: 'DeFi', name: 'dYdX' },
  { symbol: 'GMXUSDT', label: 'GMX', group: 'DeFi', name: 'GMX' },
  { symbol: 'JUPUSDT', label: 'JUP', group: 'DeFi', name: 'Jupiter' },
  { symbol: 'RAYUSDT', label: 'RAY', group: 'DeFi', name: 'Raydium' },
  { symbol: 'CAKEUSDT', label: 'CAKE', group: 'DeFi', name: 'PancakeSwap' },
  { symbol: 'RUNEUSDT', label: 'RUNE', group: 'DeFi', name: 'THORChain' },
  { symbol: 'ENAUSDT', label: 'ENA', group: 'DeFi', name: 'Ethena' },
  { symbol: 'EIGENUSDT', label: 'EIGEN', group: 'DeFi', name: 'EigenLayer' },
  { symbol: 'ETHFIUSDT', label: 'ETHFI', group: 'DeFi', name: 'ether.fi' },
  { symbol: 'ONDOUSDT', label: 'ONDO', group: 'DeFi', name: 'Ondo' },
  { symbol: 'RSRUSDT', label: 'RSR', group: 'DeFi', name: 'Reserve Rights' },
  { symbol: 'YFIUSDT', label: 'YFI', group: 'DeFi', name: 'yearn' },
  { symbol: 'BALUSDT', label: 'BAL', group: 'DeFi', name: 'Balancer' },

  // ── AI / Data ──────────────────────────────────────────
  { symbol: 'TAOUSDT', label: 'TAO', group: 'AI', name: 'Bittensor' },
  { symbol: 'FETUSDT', label: 'FET', group: 'AI', name: 'Fetch.ai' },
  { symbol: 'RENDERUSDT', label: 'RENDER', group: 'AI', name: 'Render' },
  { symbol: 'RNDRUSDT', label: 'RNDR', group: 'AI', name: 'Render (legacy)' },
  { symbol: 'WLDUSDT', label: 'WLD', group: 'AI', name: 'Worldcoin' },
  { symbol: 'ARKMUSDT', label: 'ARKM', group: 'AI', name: 'Arkham' },
  { symbol: 'AIUSDT', label: 'AI', group: 'AI', name: 'Sleepless AI' },
  { symbol: 'AGIXUSDT', label: 'AGIX', group: 'AI', name: 'SingularityNET' },
  { symbol: 'OCEANUSDT', label: 'OCEAN', group: 'AI', name: 'Ocean Protocol' },
  { symbol: 'NMRUSDT', label: 'NMR', group: 'AI', name: 'Numeraire' },
  { symbol: 'GRTUSDT', label: 'GRT', group: 'AI', name: 'The Graph' },
  { symbol: 'PHBUSDT', label: 'PHB', group: 'AI', name: 'Phoenix' },
  { symbol: 'AIXBTUSDT', label: 'AIXBT', group: 'AI', name: 'aixbt' },
  { symbol: 'VIRTUALUSDT', label: 'VIRTUAL', group: 'AI', name: 'Virtuals' },
  { symbol: 'IOUSDT', label: 'IO', group: 'AI', name: 'io.net' },
  { symbol: 'NOSUSDT', label: 'NOS', group: 'AI', name: 'Nosana' },

  // ── Meme ───────────────────────────────────────────────
  { symbol: 'PEPEUSDT', label: 'PEPE', group: 'Meme', name: 'Pepe' },
  { symbol: 'SHIBUSDT', label: 'SHIB', group: 'Meme', name: 'Shiba Inu' },
  { symbol: 'WIFUSDT', label: 'WIF', group: 'Meme', name: 'dogwifhat' },
  { symbol: 'BONKUSDT', label: 'BONK', group: 'Meme', name: 'Bonk' },
  { symbol: 'FLOKIUSDT', label: 'FLOKI', group: 'Meme', name: 'FLOKI' },
  { symbol: 'MEMEUSDT', label: 'MEME', group: 'Meme', name: 'Memecoin' },
  { symbol: 'BOMEUSDT', label: 'BOME', group: 'Meme', name: 'BOOK OF MEME' },
  { symbol: '1000SATSUSDT', label: 'SATS', group: 'Meme', name: 'SATS' },
  { symbol: 'ORDIUSDT', label: 'ORDI', group: 'Meme', name: 'ORDI' },
  { symbol: 'PEOPLEUSDT', label: 'PEOPLE', group: 'Meme', name: 'ConstitutionDAO' },
  { symbol: 'TURBOUSDT', label: 'TURBO', group: 'Meme', name: 'Turbo' },
  { symbol: 'NEIROUSDT', label: 'NEIRO', group: 'Meme', name: 'Neiro' },
  { symbol: 'PNUTUSDT', label: 'PNUT', group: 'Meme', name: 'Peanut' },
  { symbol: 'ACTUSDT', label: 'ACT', group: 'Meme', name: 'Act I' },
  { symbol: 'GOATUSDT', label: 'GOAT', group: 'Meme', name: 'Goatseus' },
  { symbol: 'DOGSUSDT', label: 'DOGS', group: 'Meme', name: 'DOGS' },
  { symbol: 'NOTUSDT', label: 'NOT', group: 'Meme', name: 'Notcoin' },
  { symbol: 'HMSTRUSDT', label: 'HMSTR', group: 'Meme', name: 'Hamster' },

  // ── Gaming / Metaverse ─────────────────────────────────
  { symbol: 'AXSUSDT', label: 'AXS', group: 'Gaming', name: 'Axie Infinity' },
  { symbol: 'SANDUSDT', label: 'SAND', group: 'Gaming', name: 'The Sandbox' },
  { symbol: 'MANAUSDT', label: 'MANA', group: 'Gaming', name: 'Decentraland' },
  { symbol: 'GALAUSDT', label: 'GALA', group: 'Gaming', name: 'Gala' },
  { symbol: 'ENJUSDT', label: 'ENJ', group: 'Gaming', name: 'Enjin' },
  { symbol: 'APEUSDT', label: 'APE', group: 'Gaming', name: 'ApeCoin' },
  { symbol: 'BEAMXUSDT', label: 'BEAMX', group: 'Gaming', name: 'Beam' },
  { symbol: 'PIXELUSDT', label: 'PIXEL', group: 'Gaming', name: 'Pixels' },
  { symbol: 'PORTALUSDT', label: 'PORTAL', group: 'Gaming', name: 'Portal' },
  { symbol: 'XAIUSDT', label: 'XAI', group: 'Gaming', name: 'Xai' },
  { symbol: 'PRIMEUSDT', label: 'PRIME', group: 'Gaming', name: 'Echelon Prime' },
  { symbol: 'ILVUSDT', label: 'ILV', group: 'Gaming', name: 'Illuvium' },
  { symbol: 'YGGUSDT', label: 'YGG', group: 'Gaming', name: 'Yield Guild' },
  { symbol: 'BIGTIMEUSDT', label: 'BIGTIME', group: 'Gaming', name: 'Big Time' },
  { symbol: 'SUPERUSDT', label: 'SUPER', group: 'Gaming', name: 'SuperVerse' },

  // ── RWA / TradFi bridge ────────────────────────────────
  { symbol: 'ONDOUSDT', label: 'ONDO', group: 'RWA', name: 'Ondo' },
  { symbol: 'POLYXUSDT', label: 'POLYX', group: 'RWA', name: 'Polymesh' },
  { symbol: 'OMUSDT', label: 'OM', group: 'RWA', name: 'MANTRA' },
  { symbol: 'TRUUSDT', label: 'TRU', group: 'RWA', name: 'TrueFi' },
  { symbol: 'CFGUSDT', label: 'CFG', group: 'RWA', name: 'Centrifuge' },
  { symbol: 'TOKENUSDT', label: 'TOKEN', group: 'RWA', name: 'TokenFi' },
  { symbol: 'RIOUSDT', label: 'RIO', group: 'RWA', name: 'Realio' },

  // ── Exchange tokens ────────────────────────────────────
  { symbol: 'BNBUSDT', label: 'BNB', group: 'Exchange', name: 'BNB' },
  { symbol: 'CAKEUSDT', label: 'CAKE', group: 'Exchange', name: 'PancakeSwap' },
  { symbol: 'GTUSDT', label: 'GT', group: 'Exchange', name: 'GateToken' },
  { symbol: 'KCSUSDT', label: 'KCS', group: 'Exchange', name: 'KuCoin Token' },
  { symbol: 'OKBUSDT', label: 'OKB', group: 'Exchange', name: 'OKB' },
  { symbol: 'CROUSDT', label: 'CRO', group: 'Exchange', name: 'Cronos' },
  { symbol: 'MXUSDT', label: 'MX', group: 'Exchange', name: 'MX Token' },
  { symbol: 'WOOUSDT', label: 'WOO', group: 'Exchange', name: 'WOO' },
  { symbol: 'SSRUSDT', label: 'SSR', group: 'Exchange', name: 'SSR' },

  // ── Payments / stablecoin rails ────────────────────────
  { symbol: 'XLMUSDT', label: 'XLM', group: 'Payments', name: 'Stellar' },
  { symbol: 'XRPUSDT', label: 'XRP', group: 'Payments', name: 'XRP' },
  { symbol: 'XLMBTC', label: 'XLM/BTC', group: 'Payments', name: 'XLM-BTC' },
  { symbol: 'PYUSDUSDT', label: 'PYUSD', group: 'Payments', name: 'PayPal USD' },
  { symbol: 'FDUSDUSDT', label: 'FDUSD', group: 'Payments', name: 'First Digital USD' },
  { symbol: 'TUSDUSDT', label: 'TUSD', group: 'Payments', name: 'TrueUSD' },
  { symbol: 'DAIUSDT', label: 'DAI', group: 'Payments', name: 'Dai' },
  { symbol: 'USDCUSDT', label: 'USDC', group: 'Payments', name: 'USD Coin' },

  // ── Infra / oracles / storage ──────────────────────────
  { symbol: 'LINKUSDT', label: 'LINK', group: 'Infra', name: 'Chainlink' },
  { symbol: 'FILUSDT', label: 'FIL', group: 'Infra', name: 'Filecoin' },
  { symbol: 'ARUSDT', label: 'AR', group: 'Infra', name: 'Arweave' },
  { symbol: 'STORJUSDT', label: 'STORJ', group: 'Infra', name: 'Storj' },
  { symbol: 'THETAUSDT', label: 'THETA', group: 'Infra', name: 'Theta' },
  { symbol: 'LIVEPEERUSDT', label: 'LPT', group: 'Infra', name: 'Livepeer' },
  { symbol: 'LPTUSDT', label: 'LPT', group: 'Infra', name: 'Livepeer' },
  { symbol: 'ENSUSDT', label: 'ENS', group: 'Infra', name: 'ENS' },
  { symbol: 'SSVUSDT', label: 'SSV', group: 'Infra', name: 'SSV Network' },
  { symbol: 'RPLUSDT', label: 'RPL', group: 'Infra', name: 'Rocket Pool' },
  { symbol: 'TWTUSDT', label: 'TWT', group: 'Infra', name: 'Trust Wallet' },
  { symbol: 'QNTUSDT', label: 'QNT', group: 'Infra', name: 'Quant' },
  { symbol: 'IOTAUSDT', label: 'IOTA', group: 'Infra', name: 'IOTA' },
  { symbol: 'IOTXUSDT', label: 'IOTX', group: 'Infra', name: 'IoTeX' },

  // ── Other liquid ───────────────────────────────────────
  { symbol: 'ETCUSDT', label: 'ETC', group: 'Other', name: 'Ethereum Classic' },
  { symbol: 'XMRUSDT', label: 'XMR', group: 'Other', name: 'Monero' },
  { symbol: 'ZECUSDT', label: 'ZEC', group: 'Other', name: 'Zcash' },
  { symbol: 'DASHUSDT', label: 'DASH', group: 'Other', name: 'Dash' },
  { symbol: 'EOSUSDT', label: 'EOS', group: 'Other', name: 'EOS' },
  { symbol: 'AAVEUSDT', label: 'AAVE', group: 'Other', name: 'Aave' },
  { symbol: 'MNTUSDT', label: 'MNT', group: 'Other', name: 'Mantle' },
  { symbol: 'STXUSDT', label: 'STX', group: 'Other', name: 'Stacks' },
  { symbol: 'RUNEUSDT', label: 'RUNE', group: 'Other', name: 'THORChain' },
  { symbol: 'NEOUSDT', label: 'NEO', group: 'Other', name: 'NEO' },
  { symbol: 'QTUMUSDT', label: 'QTUM', group: 'Other', name: 'Qtum' },
  { symbol: 'WAVESUSDT', label: 'WAVES', group: 'Other', name: 'Waves' },
  { symbol: 'CHZUSDT', label: 'CHZ', group: 'Other', name: 'Chiliz' },
  { symbol: 'BATUSDT', label: 'BAT', group: 'Other', name: 'Basic Attention' },
  { symbol: 'ANKRUSDT', label: 'ANKR', group: 'Other', name: 'Ankr' },
  { symbol: 'SKLUSDT', label: 'SKL', group: 'Other', name: 'Skale' },
  { symbol: 'CELRUSDT', label: 'CELR', group: 'Other', name: 'Celer' },
  { symbol: 'HOTUSDT', label: 'HOT', group: 'Other', name: 'Holo' },
  { symbol: 'ZRXUSDT', label: 'ZRX', group: 'Other', name: '0x' },
  { symbol: 'BANDUSDT', label: 'BAND', group: 'Other', name: 'Band Protocol' },
  { symbol: 'KAVAUSDT', label: 'KAVA', group: 'Other', name: 'Kava' },
  { symbol: 'CELOUSDT', label: 'CELO', group: 'Other', name: 'Celo' },
  { symbol: 'ONEUSDT', label: 'ONE', group: 'Other', name: 'Harmony' },
  { symbol: 'GMTUSDT', label: 'GMT', group: 'Other', name: 'STEPN' },
  { symbol: 'APTUSDT', label: 'APT', group: 'Other', name: 'Aptos' },
]

/** Unique symbols preserving first occurrence order */
export function uniquePresets(): SymbolPreset[] {
  const seen = new Set<string>()
  const out: SymbolPreset[] = []
  for (const p of SYMBOL_PRESETS) {
    if (seen.has(p.symbol)) continue
    seen.add(p.symbol)
    out.push(p)
  }
  return out
}

export function presetsByGroup(group: SymbolGroup): SymbolPreset[] {
  return uniquePresets().filter((p) => p.group === group)
}

export function searchPresets(query: string): SymbolPreset[] {
  const q = query.trim().toLowerCase()
  if (!q) return uniquePresets()
  return uniquePresets().filter(
    (p) =>
      p.symbol.toLowerCase().includes(q) ||
      p.label.toLowerCase().includes(q) ||
      (p.name?.toLowerCase().includes(q) ?? false) ||
      p.group.toLowerCase().includes(q)
  )
}

export const ALL_INTERVALS = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
] as const
