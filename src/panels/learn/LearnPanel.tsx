/**
 * Learn – catalog from /content/learn/catalog.json
 * Lessons, glossary, videos, quizzes · search · completed in localStorage.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  LearnCatalog,
  LearnContentItem,
  LearnQuiz,
  LearnItemType,
} from './types'
import { getCompletedMap, setCompleted } from './progress'

const CATALOG_URL = '/content/learn/catalog.json'

const TYPE_FILTERS: { id: LearnItemType | 'all'; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'lesson', label: 'Lezioni' },
  { id: 'glossary', label: 'Glossario' },
  { id: 'video', label: 'Video' },
  { id: 'quiz', label: 'Quiz' },
]

function itemTitle(it: LearnContentItem): string {
  if (it.type === 'glossary') return it.term
  return it.title
}

function itemSearchText(it: LearnContentItem): string {
  if (it.type === 'lesson') return `${it.title} ${it.summary ?? ''} ${it.body}`
  if (it.type === 'glossary') return `${it.term} ${it.definition}`
  if (it.type === 'video') return `${it.title} ${it.summary ?? ''}`
  return `${it.title} ${it.questions.map((q) => q.prompt).join(' ')}`
}

function flattenCatalog(c: LearnCatalog): LearnContentItem[] {
  return [...c.lessons, ...c.glossary, ...c.videos, ...c.quizzes]
}

export function LearnPanel() {
  const [catalog, setCatalog] = useState<LearnCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<LearnItemType | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [completed, setCompletedState] = useState<Record<string, number>>(() =>
    typeof localStorage !== 'undefined' ? getCompletedMap() : {}
  )
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(CATALOG_URL, {
        signal,
        headers: { Accept: 'application/json' },
        cache: 'no-cache',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as LearnCatalog
      if (!data || !Array.isArray(data.lessons)) throw new Error('Catalog invalido')
      setCatalog({
        ...data,
        lessons: data.lessons ?? [],
        glossary: data.glossary ?? [],
        videos: data.videos ?? [],
        quizzes: data.quizzes ?? [],
        categories: data.categories ?? [],
      })
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  const items = useMemo(() => (catalog ? flattenCatalog(catalog) : []), [catalog])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (category !== 'all' && it.category !== category) return false
      if (typeFilter !== 'all' && it.type !== typeFilter) return false
      if (!q) return true
      return itemSearchText(it).toLowerCase().includes(q)
    })
  }, [items, query, category, typeFilter])

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  )

  useEffect(() => {
    setQuizAnswers({})
    setQuizSubmitted(false)
  }, [selectedId])

  const toggleDone = (id: string) => {
    const next = !completed[id]
    const map = setCompleted(id, next)
    setCompletedState(map)
  }

  const doneCount = Object.keys(completed).length
  const totalCount = items.length

  const renderDetail = (it: LearnContentItem) => {
    if (it.type === 'lesson') {
      return (
        <div className="space-y-2">
          {it.summary && <p className="text-[#848e9c]">{it.summary}</p>}
          <div className="text-[#eaecef] whitespace-pre-wrap leading-relaxed">{it.body}</div>
        </div>
      )
    }
    if (it.type === 'glossary') {
      return (
        <div>
          <div className="text-sm font-semibold text-[#f0b90b] mb-1">{it.term}</div>
          <p className="text-[#eaecef] leading-relaxed">{it.definition}</p>
        </div>
      )
    }
    if (it.type === 'video') {
      return (
        <div className="space-y-2">
          {it.summary && <p className="text-[#848e9c]">{it.summary}</p>}
          <div className="relative w-full aspect-video bg-black rounded overflow-hidden">
            <iframe
              title={it.title}
              src={`https://www.youtube.com/embed/${encodeURIComponent(it.videoId)}?rel=0&modestbranding=1`}
              className="absolute inset-0 w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {it.durationMin != null && (
            <div className="text-[10px] text-[#5e6673]">~{it.durationMin} min</div>
          )}
        </div>
      )
    }
    // quiz
    const quiz = it as LearnQuiz
    let score = 0
    if (quizSubmitted) {
      for (const q of quiz.questions) {
        if (quizAnswers[q.id] === q.answerIndex) score++
      }
    }
    return (
      <div className="space-y-3">
        {quiz.questions.map((q, qi) => (
          <div key={q.id} className="rounded border border-[#2b3139] p-2 space-y-1.5">
            <div className="text-[#eaecef] font-medium">
              {qi + 1}. {q.prompt}
            </div>
            <div className="space-y-1">
              {q.options.map((opt, oi) => {
                const chosen = quizAnswers[q.id] === oi
                let extra = 'border-[#2b3139] text-[#c8cdd3]'
                if (quizSubmitted) {
                  if (oi === q.answerIndex) extra = 'border-terminal-green/50 text-terminal-green bg-terminal-green/10'
                  else if (chosen) extra = 'border-terminal-red/50 text-terminal-red bg-terminal-red/10'
                } else if (chosen) {
                  extra = 'border-[#f0b90b]/50 text-[#f0b90b] bg-[#f0b90b]/10'
                }
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={quizSubmitted}
                    className={`w-full text-left px-2 py-1 rounded border text-[11px] ${extra}`}
                    onClick={() =>
                      setQuizAnswers((prev) => ({ ...prev, [q.id]: oi }))
                    }
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          {!quizSubmitted ? (
            <button
              type="button"
              className="px-2 py-1 rounded bg-[#f0b90b] text-[#0b0e11] text-[11px] font-medium disabled:opacity-40"
              disabled={quiz.questions.some((q) => quizAnswers[q.id] == null)}
              onClick={() => {
                setQuizSubmitted(true)
                const allOk = quiz.questions.every(
                  (q) => quizAnswers[q.id] === q.answerIndex
                )
                if (allOk) {
                  const map = setCompleted(quiz.id, true)
                  setCompletedState(map)
                }
              }}
            >
              Verifica risposte
            </button>
          ) : (
            <>
              <span className="text-[11px] text-[#eaecef]">
                Punteggio: {score}/{quiz.questions.length}
              </span>
              <button
                type="button"
                className="px-2 py-1 rounded border border-terminal-border text-[11px] text-terminal-muted"
                onClick={() => {
                  setQuizAnswers({})
                  setQuizSubmitted(false)
                }}
              >
                Ripeti
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 text-[11px] bg-terminal-panel text-terminal-text">
      <div className="px-2 py-1.5 border-b border-terminal-border shrink-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-semibold text-[#eaecef] mr-1">
            {catalog?.title ?? 'Learn'}
          </span>
          <span className="text-[10px] text-[#848e9c]">
            {doneCount}/{totalCount} completati
          </span>
          <button
            type="button"
            className="ml-auto text-xxs px-1.5 py-0.5 rounded border border-terminal-border text-terminal-muted hover:text-[#f0b90b]"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? '…' : '↻'}
          </button>
        </div>
        <input
          type="search"
          placeholder="Cerca lezioni, termini, quiz…"
          className="w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-[11px] text-[#eaecef]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={`text-xxs px-1.5 py-0.5 rounded border ${
              category === 'all'
                ? 'border-[#f0b90b]/50 text-[#f0b90b]'
                : 'border-terminal-border text-terminal-muted'
            }`}
            onClick={() => setCategory('all')}
          >
            Tutte
          </button>
          {(catalog?.categories ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              className={`text-xxs px-1.5 py-0.5 rounded border ${
                category === c.id
                  ? 'border-[#f0b90b]/50 text-[#f0b90b]'
                  : 'border-terminal-border text-terminal-muted'
              }`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`text-xxs px-1.5 py-0.5 rounded border ${
                typeFilter === t.id
                  ? 'bg-[#1e2329] border-[#2b3139] text-[#eaecef]'
                  : 'border-transparent text-[#5e6673]'
              }`}
              onClick={() => setTypeFilter(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="px-2 py-1 text-[10px] text-terminal-red border-b border-terminal-red/30">
          {error} — verifica /content/learn/catalog.json
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        <div className="w-[42%] min-w-[8rem] border-r border-terminal-border overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-2 py-6 text-center text-terminal-muted">
              {loading ? 'Caricamento…' : 'Nessun contenuto'}
            </div>
          ) : (
            <ul className="divide-y divide-terminal-border/50">
              {filtered.map((it) => {
                const done = !!completed[it.id]
                const active = selectedId === it.id
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      className={`w-full text-left px-2 py-1.5 hover:bg-[#12161c] ${
                        active ? 'bg-[#1e2329]' : ''
                      }`}
                      onClick={() => setSelectedId(it.id)}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[9px] uppercase tracking-wide shrink-0 ${
                            it.type === 'quiz'
                              ? 'text-[#f0b90b]'
                              : it.type === 'video'
                                ? 'text-terminal-blue'
                                : 'text-[#848e9c]'
                          }`}
                        >
                          {it.type}
                        </span>
                        {done && (
                          <span className="text-[9px] text-terminal-green ml-auto">✓</span>
                        )}
                      </div>
                      <div className="text-[#eaecef] font-medium leading-snug">
                        {itemTitle(it)}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto p-2">
          {!selected ? (
            <div className="text-terminal-muted py-8 text-center">
              Seleziona una voce dall&apos;elenco
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] uppercase text-[#848e9c]">
                    {selected.type} · {selected.category}
                  </div>
                  <h2 className="text-sm font-semibold text-[#eaecef]">
                    {itemTitle(selected)}
                  </h2>
                </div>
                <button
                  type="button"
                  className={`shrink-0 text-[10px] px-2 py-1 rounded border ${
                    completed[selected.id]
                      ? 'border-terminal-green/50 text-terminal-green'
                      : 'border-terminal-border text-terminal-muted hover:text-[#f0b90b]'
                  }`}
                  onClick={() => toggleDone(selected.id)}
                >
                  {completed[selected.id] ? 'Completato ✓' : 'Segna completato'}
                </button>
              </div>
              {renderDetail(selected)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
