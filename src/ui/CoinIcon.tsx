/**
 * Wallet-style coin logo.
 * Icons: free CDN (cryptocurrency-icons). Unknown assets → colored letter avatar.
 * No paid API. Offline/broken image → fallback without breaking layout.
 */

import { useMemo, useState } from 'react'
import { resolveSymbolMeta } from '@/data/symbolMeta'

/** CDN icon id overrides when ticker ≠ filename */
const ICON_ALIASES: Record<string, string> = {
  BTC: 'btc',
  ETH: 'eth',
  BNB: 'bnb',
  SOL: 'sol',
  XRP: 'xrp',
  ADA: 'ada',
  DOGE: 'doge',
  AVAX: 'avax',
  DOT: 'dot',
  LINK: 'link',
  TRX: 'trx',
  TON: 'ton',
  LTC: 'ltc',
  BCH: 'bch',
  ATOM: 'atom',
  NEAR: 'near',
  MATIC: 'matic',
  POL: 'matic',
  OP: 'op',
  ARB: 'arb',
  UNI: 'uni',
  AAVE: 'aave',
  MKR: 'mkr',
  PEPE: 'pepe',
  SHIB: 'shib',
  APT: 'apt',
  SUI: 'sui',
  INJ: 'inj',
  FIL: 'fil',
  ICP: 'icp',
  RENDER: 'rndr',
  FET: 'fet',
  WIF: 'wif',
  BONK: 'bonk',
  FLOKI: 'floki',
  XLM: 'xlm',
  ETC: 'etc',
  XMR: 'xmr',
  ZEC: 'zec',
  SAND: 'sand',
  MANA: 'mana',
  AXS: 'axs',
  GALA: 'gala',
  IMX: 'imx',
  STX: 'stx',
  TIA: 'tia',
  SEI: 'sei',
  HBAR: 'hbar',
  ALGO: 'algo',
  FTM: 'ftm',
  VET: 'vet',
  EGLD: 'egld',
  RUNE: 'rune',
  CRV: 'crv',
  COMP: 'comp',
  SNX: 'snx',
  SUSHI: 'sushi',
  '1INCH': '1inch',
  DYDX: 'dydx',
  CAKE: 'cake',
  LDO: 'ldo',
  GRT: 'grt',
  ENS: 'ens',
  QNT: 'qnt',
  THETA: 'theta',
  LPT: 'lpt',
  AR: 'ar',
  STORJ: 'storj',
  BAT: 'bat',
  ZRX: 'zrx',
  CHZ: 'chz',
  ENJ: 'enj',
  APE: 'ape',
  CRO: 'cro',
  OKB: 'okb',
  USDC: 'usdc',
  DAI: 'dai',
  TUSD: 'tusd',
  WLD: 'wld',
  TAO: 'tao',
  JUP: 'jup',
  RAY: 'ray',
  ONDO: 'ondo',
  ENA: 'ena',
  SATS: 'sats',
  ORDI: 'ordi',
  NOT: 'not',
  KAS: 'kas',
  MINA: 'mina',
  FLOW: 'flow',
  ROSE: 'rose',
  ZEN: 'zen',
  ZIL: 'zil',
  XTZ: 'xtz',
  NEO: 'neo',
  EOS: 'eos',
  DASH: 'dash',
  IOTA: 'miota',
  HOT: 'hot',
  ANKR: 'ankr',
  CELO: 'celo',
  KAVA: 'kava',
  ONE: 'one',
  SKL: 'skl',
  CELR: 'celr',
  BAND: 'band',
  RPL: 'rpl',
  YFI: 'yfi',
  BAL: 'bal',
  WOO: 'woo',
  LRC: 'lrc',
  GMT: 'gmt',
  ILV: 'ilv',
  YGG: 'ygg',
  SUPER: 'super',
  BEAMX: 'beam',
  STRK: 'strk',
  BLAST: 'blast',
  METIS: 'metis',
  MNT: 'mnt',
  CFX: 'cfx',
  CKB: 'ckb',
  IOTX: 'iotx',
  QTUM: 'qtum',
  PEOPLE: 'people',
  NMR: 'nmr',
  PHB: 'phb',
  TRU: 'tru',
  CFG: 'cfg',
  OM: 'om',
  POLYX: 'polyx',
  SSV: 'ssv',
  GMX: 'gmx',
  PENDLE: 'pendle',
}

function iconIdForBase(base: string): string {
  const u = base.toUpperCase().replace(/^1000/, '')
  if (ICON_ALIASES[u]) return ICON_ALIASES[u]
  if (ICON_ALIASES[base.toUpperCase()]) return ICON_ALIASES[base.toUpperCase()]
  return u.toLowerCase()
}

function hashHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}

interface CoinIconProps {
  /** Trading pair (BTCUSDT) or base (BTC) */
  symbol: string
  size?: number
  className?: string
}

export function CoinIcon({ symbol, size = 20, className = '' }: CoinIconProps) {
  const meta = useMemo(() => resolveSymbolMeta(symbol), [symbol])
  const iconId = useMemo(() => iconIdForBase(meta.base || meta.label), [meta.base, meta.label])
  const [failed, setFailed] = useState(false)

  // Reset when symbol changes
  const [prev, setPrev] = useState(symbol)
  if (prev !== symbol) {
    setPrev(symbol)
    setFailed(false)
  }

  const letter = (meta.label || meta.base || '?').slice(0, 1).toUpperCase()
  const hue = hashHue(meta.base || symbol)

  if (failed || !iconId || iconId === '—') {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full font-bold text-[10px] shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: `hsl(${hue} 55% 42%)`,
          color: '#fff',
        }}
        title={meta.pair}
        aria-hidden
      >
        {letter}
      </span>
    )
  }

  // SVG from free open-source set (jsDelivr)
  const src = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${iconId}.svg`

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`rounded-full shrink-0 object-contain bg-[#12161c] ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      title={meta.name ? `${meta.name} (${meta.pair})` : meta.pair}
    />
  )
}
