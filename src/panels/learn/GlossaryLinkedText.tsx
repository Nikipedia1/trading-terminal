/** Renders text with Learn glossary terms as clickable links. */

import { useEffect, useState } from 'react'
import { loadGlossaryEntries, linkifyGlossary, findGlossaryHits } from './glossaryIndex'
import type { LearnGlossaryEntry } from './types'
import { LEARN_OPEN_EVENT, type LearnOpenDetail } from './types'
import { useLayoutStore } from '@/stores/layoutStore'

function openGlossary(glossaryId: string) {
  useLayoutStore.getState().addWidget('learn')
  window.dispatchEvent(
    new CustomEvent<LearnOpenDetail>(LEARN_OPEN_EVENT, {
      detail: { glossaryId },
    })
  )
}

export function GlossaryLinkedText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const [entries, setEntries] = useState<LearnGlossaryEntry[]>([])

  useEffect(() => {
    const ac = new AbortController()
    void loadGlossaryEntries(ac.signal)
      .then(setEntries)
      .catch(() => setEntries([]))
    return () => ac.abort()
  }, [])

  const parts = linkifyGlossary(text, entries)

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.type === 'term' && p.id ? (
          <button
            key={i}
            type="button"
            title={`Learn · ${p.term}`}
            className="text-[#5b8def] underline decoration-[#5b8def]/40 underline-offset-2 hover:text-[#8bb0f5] hover:decoration-[#8bb0f5] font-medium px-0.5"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              openGlossary(p.id!)
            }}
          >
            {p.value}
          </button>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </span>
  )
}

/** Chip row of glossary hits found in one or more strings. */
export function GlossaryHitChips({
  texts,
  label = 'Glossario Learn',
}: {
  texts: (string | undefined | null)[]
  label?: string
}) {
  const [entries, setEntries] = useState<LearnGlossaryEntry[]>([])

  useEffect(() => {
    const ac = new AbortController()
    void loadGlossaryEntries(ac.signal)
      .then(setEntries)
      .catch(() => setEntries([]))
    return () => ac.abort()
  }, [])

  const hits = findGlossaryHits(texts.filter(Boolean).join('\n'), entries)
  if (hits.length === 0) return null

  return (
    <div className="space-y-1">
      <div className="text-[9px] uppercase tracking-wide text-[#848e9c]">{label}</div>
      <div className="flex flex-wrap gap-1">
        {hits.map((h) => (
          <button
            key={h.id}
            type="button"
            title={h.definition}
            className="px-1.5 py-0.5 rounded border border-[#5b8def]/40 text-[#5b8def] bg-[#5b8def]/10 hover:bg-[#5b8def]/20 text-[10px]"
            onClick={() => openGlossary(h.id)}
          >
            {h.term}
          </button>
        ))}
      </div>
    </div>
  )
}
