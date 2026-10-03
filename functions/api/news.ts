/**
 * GET /api/news – aggregate real RSS feeds into unified JSON.
 * Sources: CoinDesk, Cointelegraph, The Block, Reuters (via Google News RSS
 * when direct Reuters feeds are unavailable/blocked).
 * Cache-Control: max-age=30. Deduplicate by canonical URL. No synthetic items.
 */

import { cors, type Env } from './auth/_shared'

export interface NewsItemDto {
  id: string
  title: string
  source: string
  url: string
  /** ISO-8601 – clients may parse either; we emit ISO */
  publishedAt: string
  tags: string[]
}

interface FeedSource {
  id: string
  name: string
  url: string
  hostFilter?: string
}

const FEEDS: FeedSource[] = [
  {
    id: 'coindesk',
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  },
  {
    id: 'cointelegraph',
    name: 'Cointelegraph',
    url: 'https://cointelegraph.com/rss',
  },
  {
    id: 'theblock',
    name: 'The Block',
    url: 'https://www.theblock.co/rss.xml',
  },
  {
    id: 'reuters',
    name: 'Reuters',
    url: 'https://news.google.com/rss/search?q=site:reuters.com+(business+OR+markets+OR+finance)&hl=en-US&gl=US&ceid=US:en',
    hostFilter: 'reuters.com',
  },
]

const UA =
  'TradingTerminalNewsBot/1.0 (+https://github.com/Nikipedia1/trading-terminal; RSS aggregator)'

/** Rich asset + macro recognition in titles (mirrored on client in assetTags.ts). */
const TAG_RULES: { tag: string; re: RegExp }[] = [
  { tag: 'BTC', re: /\b(bitcoin|btc)\b/i },
  { tag: 'ETH', re: /\b(ethereum|ether|eth)\b/i },
  { tag: 'SOL', re: /\b(solana|sol)\b/i },
  { tag: 'BNB', re: /\b(binance coin|bnb)\b/i },
  { tag: 'XRP', re: /\b(ripple|xrp)\b/i },
  { tag: 'ADA', re: /\b(cardano|ada)\b/i },
  { tag: 'DOGE', re: /\b(dogecoin|doge)\b/i },
  { tag: 'AVAX', re: /\b(avalanche|avax)\b/i },
  { tag: 'DOT', re: /\b(polkadot|dot)\b/i },
  { tag: 'LINK', re: /\b(chainlink|link)\b/i },
  { tag: 'TON', re: /\b(toncoin|ton)\b/i },
  { tag: 'TRX', re: /\b(tron|trx)\b/i },
  { tag: 'LTC', re: /\b(litecoin|ltc)\b/i },
  { tag: 'ATOM', re: /\b(cosmos|atom)\b/i },
  { tag: 'NEAR', re: /\b(near protocol|near)\b/i },
  { tag: 'APT', re: /\b(aptos|apt)\b/i },
  { tag: 'SUI', re: /\b(sui)\b/i },
  { tag: 'ARB', re: /\b(arbitrum|arb)\b/i },
  { tag: 'OP', re: /\b(optimism)\b/i },
  { tag: 'MATIC', re: /\b(polygon|matic)\b/i },
  { tag: 'PEPE', re: /\b(pepe)\b/i },
  { tag: 'SHIB', re: /\b(shiba|shib)\b/i },
  { tag: 'WIF', re: /\b(dogwifhat|wif)\b/i },
  { tag: 'UNI', re: /\b(uniswap|uni)\b/i },
  { tag: 'AAVE', re: /\b(aave)\b/i },
  { tag: 'RENDER', re: /\b(render|rndr)\b/i },
  { tag: 'TAO', re: /\b(bittensor|tao)\b/i },
  { tag: 'FIL', re: /\b(filecoin|fil)\b/i },
  { tag: 'FOMC', re: /\b(fomc|federal open market)\b/i },
  { tag: 'CPI', re: /\b(cpi|consumer price index)\b/i },
  { tag: 'ETF', re: /\b(etf|exchange[- ]traded fund)\b/i },
  { tag: 'SEC', re: /\b(sec\b|securities and exchange)\b/i },
  { tag: 'FED', re: /\b(federal reserve|\bfed\b|powell)\b/i },
  {
    tag: 'macro',
    re: /\b(inflation|gdp|treasury|rate cut|rate hike|recession|regulation|macro|interest rate)\b/i,
  },
]

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .trim()
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function pick(block: string, ...tags: string[]): string {
  for (const tag of tags) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
    const m = block.match(re)
    if (m?.[1]) return stripTags(m[1])
  }
  return ''
}

function unwrapUrl(raw: string): string {
  const u = decodeEntities(raw).trim()
  if (!u) return ''
  try {
    const parsed = new URL(u)
    if (parsed.hostname.includes('google.') && parsed.searchParams.has('url')) {
      return parsed.searchParams.get('url') || u
    }
  } catch {
    /* keep raw */
  }
  return u
}

function canonicalUrl(raw: string): string {
  try {
    const u = new URL(unwrapUrl(raw))
    u.hash = ''
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'].forEach(
      (k) => u.searchParams.delete(k)
    )
    return u.toString()
  } catch {
    return unwrapUrl(raw)
  }
}

function parsePublished(raw: string): string | null {
  if (!raw) return null
  const t = Date.parse(raw)
  if (!Number.isFinite(t)) return null
  return new Date(t).toISOString()
}

function extractTags(title: string, sourceName: string): string[] {
  const tags = new Set<string>()
  const hay = `${title} ${sourceName}`
  for (const rule of TAG_RULES) {
    if (rule.re.test(hay)) tags.add(rule.tag)
  }
  if (sourceName === 'Reuters' && tags.size === 0) tags.add('macro')
  return [...tags]
}

function hashId(url: string): string {
  let h = 2166136261
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `n-${(h >>> 0).toString(16)}`
}

function parseRssItems(xml: string, source: FeedSource): NewsItemDto[] {
  const items: NewsItemDto[] = []
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
  for (const block of blocks) {
    const title = pick(block, 'title')
    const link =
      pick(block, 'link') ||
      (block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ?? '')
    const pub =
      parsePublished(pick(block, 'pubDate', 'published', 'dc:date', 'updated')) ??
      null
    if (!title || !link) continue
    const url = canonicalUrl(link)
    if (!url.startsWith('http')) continue
    if (source.hostFilter) {
      try {
        if (!new URL(url).hostname.includes(source.hostFilter)) continue
      } catch {
        continue
      }
    }
    items.push({
      id: hashId(url),
      title,
      source: source.name,
      url,
      publishedAt: pub ?? new Date().toISOString(),
      tags: extractTags(title, source.name),
    })
  }
  return items
}

async function fetchFeed(source: FeedSource): Promise<{
  items: NewsItemDto[]
  error?: string
}> {
  try {
    const res = await fetch(source.url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'User-Agent': UA,
      },
      cf: { cacheTtl: 30, cacheEverything: true },
    } as RequestInit)
    if (!res.ok) return { items: [], error: `${source.id} HTTP ${res.status}` }
    const text = await res.text()
    if (!text.includes('<item') && !text.includes('<entry')) {
      return { items: [], error: `${source.id} not RSS` }
    }
    return { items: parseRssItems(text, source) }
  } catch (e) {
    return {
      items: [],
      error: `${source.id}: ${e instanceof Error ? e.message : 'fetch failed'}`,
    }
  }
}

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const results = await Promise.all(FEEDS.map(fetchFeed))
  const byUrl = new Map<string, NewsItemDto>()
  const errors: string[] = []

  for (const r of results) {
    if (r.error) errors.push(r.error)
    for (const item of r.items) {
      if (!byUrl.has(item.url)) byUrl.set(item.url, item)
    }
  }

  const items = [...byUrl.values()].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  )

  const body = {
    items,
    fetchedAt: new Date().toISOString(),
    sources: FEEDS.map((f) => f.name),
    ...(errors.length ? { warnings: errors } : {}),
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=30, s-maxage=30',
      ...cors(ctx.request),
    },
  })
}
