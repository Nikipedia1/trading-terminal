/**
 * Live TV – official YouTube iframe embed.
 * Channel list from /config/live-tv-channels.json (name + channelId | videoId).
 * Mute by default; desk widget is resizable via grid.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LiveTvChannel, LiveTvConfigFile } from './types'

const CONFIG_URL = '/config/live-tv-channels.json'

function buildEmbedSrc(ch: LiveTvChannel, muted: boolean): string | null {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: muted ? '1' : '0',
    controls: '1',
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
  })
  if (ch.videoId && ch.videoId.trim()) {
    return `https://www.youtube.com/embed/${encodeURIComponent(ch.videoId.trim())}?${params}`
  }
  if (ch.channelId && ch.channelId.trim()) {
    params.set('channel', ch.channelId.trim())
    return `https://www.youtube.com/embed/live_stream?${params}`
  }
  return null
}

export function LiveTvPanel() {
  const [channels, setChannels] = useState<LiveTvChannel[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [muted, setMuted] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const loadConfig = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(CONFIG_URL, {
        signal,
        headers: { Accept: 'application/json' },
        cache: 'no-cache',
      })
      if (!res.ok) throw new Error(`Config HTTP ${res.status}`)
      const data = (await res.json()) as LiveTvConfigFile
      const list = Array.isArray(data.channels) ? data.channels.filter((c) => c?.id && c?.name) : []
      if (list.length === 0) throw new Error('Nessun canale in live-tv-channels.json')
      setChannels(list)
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev
        const def = data.defaultChannelId
        if (def && list.some((c) => c.id === def)) return def
        return list[0]!.id
      })
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Config load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    void loadConfig(ac.signal)
    return () => ac.abort()
  }, [loadConfig])

  const selected = useMemo(
    () => channels.find((c) => c.id === selectedId) ?? channels[0] ?? null,
    [channels, selectedId]
  )

  const embedSrc = useMemo(() => {
    if (!selected) return null
    return buildEmbedSrc(selected, muted)
  }, [selected, muted])

  return (
    <div className="flex flex-col h-full min-h-0 bg-terminal-panel text-terminal-text text-[11px]">
      <div className="px-2 py-1.5 border-b border-terminal-border shrink-0 flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-[#eaecef]">Live TV</span>
        <select
          className="bg-terminal-bg border border-terminal-border rounded px-1.5 py-0.5 text-[11px] max-w-[12rem] text-[#eaecef]"
          value={selectedId}
          disabled={loading || channels.length === 0}
          onChange={(e) => {
            setSelectedId(e.target.value)
            setReloadKey((k) => k + 1)
          }}
          title="Seleziona canale"
        >
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`text-xxs px-1.5 py-0.5 rounded border ${
            muted
              ? 'border-[#2b3139] text-[#848e9c]'
              : 'border-[#f0b90b]/50 text-[#f0b90b]'
          }`}
          title={muted ? 'Audio disattivato (default)' : 'Audio attivo'}
          onClick={() => {
            setMuted((m) => !m)
            setReloadKey((k) => k + 1)
          }}
        >
          {muted ? '🔇 Mute' : '🔊 Unmute'}
        </button>
        <button
          type="button"
          className="text-xxs px-1.5 py-0.5 rounded border border-terminal-border text-terminal-muted hover:text-[#f0b90b]"
          title="Ricarica stream"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          ↻
        </button>
        <button
          type="button"
          className="text-xxs px-1.5 py-0.5 rounded border border-terminal-border text-terminal-muted hover:text-[#eaecef]"
          title="Ricarica lista canali da JSON"
          onClick={() => void loadConfig()}
        >
          Config
        </button>
        {selected?.channelId && (
          <span className="ml-auto text-[9px] text-[#5e6673] truncate max-w-[8rem]" title={selected.channelId}>
            ch:{selected.channelId.slice(0, 8)}…
          </span>
        )}
        {selected?.videoId && !selected.channelId && (
          <span className="ml-auto text-[9px] text-[#5e6673] truncate max-w-[8rem]" title={selected.videoId}>
            vid:{selected.videoId.slice(0, 8)}…
          </span>
        )}
      </div>

      {error && (
        <div className="px-2 py-1 text-[10px] text-terminal-red border-b border-terminal-red/30 shrink-0">
          {error} — verifica public/config/live-tv-channels.json
        </div>
      )}

      <div className="flex-1 min-h-0 relative bg-[#000]">
        {loading && !embedSrc ? (
          <div className="absolute inset-0 flex items-center justify-center text-terminal-muted text-sm">
            Caricamento canali…
          </div>
        ) : embedSrc ? (
          <iframe
            key={`${selected?.id ?? 'x'}-${reloadKey}-${muted ? 'm' : 'u'}`}
            title={selected ? `Live TV · ${selected.name}` : 'Live TV'}
            src={embedSrc}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-terminal-muted text-sm px-4 text-center">
            Nessuno stream configurato. Aggiungi channelId o videoId nel JSON.
          </div>
        )}
      </div>

      <div className="px-2 py-0.5 text-[9px] text-[#5e6673] border-t border-terminal-border shrink-0">
        Embed ufficiale YouTube · mute di default · ridimensiona il pannello dal bordo griglia
      </div>
    </div>
  )
}
