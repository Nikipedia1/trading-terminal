/**
 * Load Learn glossary + match phrases in AI / news text.
 */

import type { LearnCatalog, LearnGlossaryEntry } from './types'

const CATALOG_URL = '/content/learn/catalog.json'

export interface GlossaryTermRef {
  id: string
  term: string
  definition: string
  /** Phrase that matched in the text (original casing from pattern). */
  matched: string
}

let cache: LearnGlossaryEntry[] | null = null
let cachePromise: Promise<LearnGlossaryEntry[]> | null = null

export async function loadGlossaryEntries(
  signal?: AbortSignal
): Promise<LearnGlossaryEntry[]> {
  if (cache) return cache
  if (!cachePromise) {
    cachePromise = (async () => {
      const res = await fetch(CATALOG_URL, {
        signal,
        headers: { Accept: 'application/json' },
        cache: 'force-cache',
      })
      if (!res.ok) throw new Error(`Glossary catalog HTTP ${res.status}`)
      const data = (await res.json()) as LearnCatalog
      const list = Array.isArray(data.glossary) ? data.glossary : []
      cache = list
      return list
    })().catch((e) => {
      cachePromise = null
      throw e
    })
  }
  return cachePromise
}

/** Build matchers sorted by phrase length desc (prefer longer matches). */
export function buildMatchers(entries: LearnGlossaryEntry[]): {
  phrase: string
  entry: LearnGlossaryEntry
}[] {
  const out: { phrase: string; entry: LearnGlossaryEntry }[] = []
  for (const e of entries) {
    out.push({ phrase: e.term, entry: e })
    for (const a of e.aliases ?? []) {
      if (a.trim()) out.push({ phrase: a.trim(), entry: e })
    }
  }
  out.sort((a, b) => b.phrase.length - a.phrase.length)
  return out
}

/**
 * Find unique glossary hits in text (first occurrence order).
 * Word-boundary aware for short tokens; substring for multi-word phrases.
 */
export function findGlossaryHits(
  text: string,
  entries: LearnGlossaryEntry[]
): GlossaryTermRef[] {
  if (!text || entries.length === 0) return []
  const matchers = buildMatchers(entries)
  const used = new Set<string>()
  const hits: GlossaryTermRef[] = []
  const lower = text.toLowerCase()

  for (const { phrase, entry } of matchers) {
    if (used.has(entry.id)) continue
    const p = phrase.toLowerCase()
    if (p.length < 2) continue
    let idx = -1
    if (/\s/.test(p) || p.length > 4) {
      idx = lower.indexOf(p)
    } else {
      const re = new RegExp(
        `(?:^|[^\\p{L}\\p{N}_])(${escapeRe(p)})(?=[^\\p{L}\\p{N}_]|$)`,
        'iu'
      )
      const m = re.exec(text)
      if (m && m.index != null) idx = m.index + (m[0].length - (m[1]?.length ?? 0))
    }
    if (idx < 0) continue
    used.add(entry.id)
    hits.push({
      id: entry.id,
      term: entry.term,
      definition: entry.definition,
      matched: text.slice(idx, idx + phrase.length),
    })
  }
  return hits
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Split text into plain + link segments for React rendering.
 * Non-overlapping; longer phrases win.
 */
export function linkifyGlossary(
  text: string,
  entries: LearnGlossaryEntry[]
): { type: 'text' | 'term'; value: string; id?: string; term?: string }[] {
  if (!text) return [{ type: 'text', value: '' }]
  const matchers = buildMatchers(entries)
  type Mark = { start: number; end: number; id: string; term: string }
  const marks: Mark[] = []
  const lower = text.toLowerCase()

  for (const { phrase, entry } of matchers) {
    const p = phrase.toLowerCase()
    if (p.length < 2) continue
    let from = 0
    while (from < lower.length) {
      let idx = -1
      let len = phrase.length
      if (/\s/.test(p) || p.length > 4) {
        idx = lower.indexOf(p, from)
      } else {
        const slice = text.slice(from)
        const re = new RegExp(
          `(?:^|[^\\p{L}\\p{N}_])(${escapeRe(p)})(?=[^\\p{L}\\p{N}_]|$)`,
          'iu'
        )
        const m = re.exec(slice)
        if (m && m.index != null && m[1]) {
          idx = from + m.index + (m[0].length - m[1].length)
          len = m[1].length
        }
      }
      if (idx < 0) break
      const end = idx + len
      const overlaps = marks.some((m) => !(end <= m.start || idx >= m.end))
      if (!overlaps) {
        marks.push({ start: idx, end, id: entry.id, term: entry.term })
      }
      from = idx + 1
    }
  }

  marks.sort((a, b) => a.start - b.start)
  const parts: { type: 'text' | 'term'; value: string; id?: string; term?: string }[] =
    []
  let cursor = 0
  for (const m of marks) {
    if (m.start > cursor) {
      parts.push({ type: 'text', value: text.slice(cursor, m.start) })
    }
    parts.push({
      type: 'term',
      value: text.slice(m.start, m.end),
      id: m.id,
      term: m.term,
    })
    cursor = m.end
  }
  if (cursor < text.length) {
    parts.push({ type: 'text', value: text.slice(cursor) })
  }
  return parts.length ? parts : [{ type: 'text', value: text }]
}
