/**
 * Pixel office floor — Munder Difflin–inspired (chunky, ink outlines, no blur).
 * Pure CSS/SVG: desks, seated avatars, status motion, flying envelopes.
 */

import { useEffect, useMemo, useState } from 'react'
import { DESK_AGENTS, agentMeta } from './agents'
import type { DeskAgentId, DeskAgentStatus } from './types'

/** Desk positions on a 12×8 tile grid (tile = 28px). */
const DESK_LAYOUT: { id: DeskAgentId; col: number; row: number }[] = [
  { id: 'orchestrator', col: 1, row: 1 },
  { id: 'technical', col: 5, row: 1 },
  { id: 'orderflow', col: 9, row: 1 },
  { id: 'risk', col: 1, row: 5 },
  { id: 'sentiment', col: 5, row: 5 },
  { id: 'trader', col: 9, row: 5 },
]

const TILE = 28
const COLS = 12
const ROWS = 8

type Envelope = {
  key: number
  fromId: DeskAgentId
  toId: DeskAgentId
}

function PixelAvatar({
  color,
  accent,
  status,
  selected,
}: {
  color: string
  accent: string
  status: DeskAgentStatus
  selected: boolean
}) {
  const thinking = status === 'thinking'
  const ready = status === 'ready'
  const err = status === 'error'
  return (
    <div
      className="relative"
      style={{
        width: 24,
        height: 28,
        imageRendering: 'pixelated',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 6,
          top: 0,
          width: 12,
          height: 12,
          background: '#e8c4a0',
          boxShadow: `inset 0 0 0 1px #1a1a1a`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 5,
          top: 0,
          width: 14,
          height: 5,
          background: accent,
          boxShadow: `inset 0 0 0 1px #1a1a1a`,
        }}
      />
      <div style={{ position: 'absolute', left: 8, top: 5, width: 2, height: 2, background: '#1a1a1a' }} />
      <div style={{ position: 'absolute', left: 14, top: 5, width: 2, height: 2, background: '#1a1a1a' }} />
      <div
        style={{
          position: 'absolute',
          left: 4,
          top: 12,
          width: 16,
          height: 12,
          background: color,
          boxShadow: `inset 0 0 0 1px #1a1a1a`,
          transform: thinking ? 'translateY(1px)' : undefined,
          transition: 'transform 120ms steps(2)',
        }}
      />
      {thinking && (
        <>
          <div
            className="animate-pulse"
            style={{
              position: 'absolute',
              left: 0,
              top: 14,
              width: 6,
              height: 4,
              background: '#e8c4a0',
              boxShadow: 'inset 0 0 0 1px #1a1a1a',
            }}
          />
          <div
            className="animate-pulse"
            style={{
              position: 'absolute',
              right: 0,
              top: 14,
              width: 6,
              height: 4,
              background: '#e8c4a0',
              boxShadow: 'inset 0 0 0 1px #1a1a1a',
            }}
          />
        </>
      )}
      <div
        style={{
          position: 'absolute',
          left: -2,
          top: -2,
          width: 28,
          height: 32,
          boxShadow: selected
            ? `0 0 0 2px #F4D35E`
            : ready
              ? `0 0 0 1px #0ecb81`
              : err
                ? `0 0 0 1px #f6465d`
                : thinking
                  ? `0 0 0 1px #F4D35E`
                  : 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

function DeskStation({
  id,
  status,
  lastBrief,
  selected,
  onSelect,
  col,
  row,
}: {
  id: DeskAgentId
  status: DeskAgentStatus
  lastBrief: string
  selected: boolean
  onSelect: () => void
  col: number
  row: number
}) {
  const m = agentMeta(id)
  const left = col * TILE
  const top = row * TILE
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${m.name} · ${m.role}`}
      style={{
        position: 'absolute',
        left,
        top,
        width: TILE * 3,
        height: TILE * 3,
        border: 'none',
        background: 'transparent',
        padding: 0,
        cursor: 'pointer',
        imageRendering: 'pixelated',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 4,
          top: 18,
          width: TILE * 3 - 8,
          height: 22,
          background: '#8B6914',
          boxShadow: 'inset 0 0 0 2px #1a1a1a, 3px 3px 0 #1a1a1a',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 14,
          top: 4,
          width: 36,
          height: 22,
          background: status === 'thinking' ? '#1e3a2f' : '#1a1a1a',
          boxShadow: 'inset 0 0 0 2px #1a1a1a, 2px 2px 0 #1a1a1a',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 3,
            background: status === 'thinking' ? '#0ecb81' : '#0d1117',
            opacity: status === 'thinking' ? 0.85 : 0.5,
          }}
        />
        {status === 'thinking' && (
          <div
            className="animate-pulse"
            style={{
              position: 'absolute',
              left: 6,
              top: 8,
              width: 2,
              height: 6,
              background: '#F4D35E',
            }}
          />
        )}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 28,
          top: 36,
          width: 20,
          height: 14,
          background: '#3d3d3d',
          boxShadow: 'inset 0 0 0 1px #1a1a1a',
        }}
      />
      <div style={{ position: 'absolute', left: 30, top: 28 }}>
        <PixelAvatar color={m.color} accent={m.accent} status={status} selected={selected} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 4,
          bottom: 2,
          right: 4,
          fontSize: 8,
          fontFamily: 'ui-monospace, monospace',
          color: selected ? '#F4D35E' : '#eaecef',
          textAlign: 'center',
          lineHeight: 1.2,
          textShadow: '1px 1px 0 #1a1a1a',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {m.name}
        <span style={{ color: '#848e9c' }}> · {m.role}</span>
      </div>
      {lastBrief && status === 'ready' && (
        <div
          style={{
            position: 'absolute',
            left: -4,
            top: -18,
            maxWidth: 90,
            fontSize: 7,
            lineHeight: 1.2,
            padding: '2px 4px',
            background: '#fff8e7',
            color: '#1a1a1a',
            boxShadow: '2px 2px 0 #1a1a1a, inset 0 0 0 1px #1a1a1a',
            fontFamily: 'ui-monospace, monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {lastBrief.slice(0, 42)}
        </div>
      )}
    </button>
  )
}

function FlyingEnvelope({
  from,
  to,
  onDone,
}: {
  from: { col: number; row: number }
  to: { col: number; row: number }
  onDone: () => void
}) {
  const [t, setT] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const dur = 700
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      setT(p)
      if (p < 1) raf = requestAnimationFrame(tick)
      else onDone()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onDone])

  const x0 = from.col * TILE + 30
  const y0 = from.row * TILE + 20
  const x1 = to.col * TILE + 30
  const y1 = to.row * TILE + 20
  const x = x0 + (x1 - x0) * t
  const y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 28

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 14,
        height: 10,
        background: '#F4D35E',
        boxShadow: 'inset 0 0 0 1px #1a1a1a, 2px 2px 0 #1a1a1a',
        zIndex: 20,
        pointerEvents: 'none',
        transform: `rotate(${t * 20 - 10}deg)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: '5px solid #6E1423',
        }}
      />
    </div>
  )
}

export function OfficeFloor({
  agentStatus,
  lastBrief,
  selected,
  onSelect,
}: {
  agentStatus: Record<DeskAgentId, DeskAgentStatus>
  lastBrief: Record<DeskAgentId, string>
  selected: DeskAgentId
  onSelect: (id: DeskAgentId) => void
}) {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const prevStatus = useMemo(() => ({ ...agentStatus }), [])

  useEffect(() => {
    for (const a of DESK_AGENTS) {
      if (a.id === 'orchestrator') continue
      if (agentStatus[a.id] === 'ready' && prevStatus[a.id] === 'thinking') {
        setEnvelopes((e) => [
          ...e,
          { key: Date.now() + Math.random(), fromId: a.id, toId: 'orchestrator' },
        ])
      }
      prevStatus[a.id] = agentStatus[a.id]
    }
  }, [agentStatus, prevStatus])

  const pos = (id: DeskAgentId) => {
    const d = DESK_LAYOUT.find((x) => x.id === id)!
    return { col: d.col, row: d.row }
  }

  const w = COLS * TILE
  const h = ROWS * TILE

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        overflow: 'auto',
        background: '#2a2a2a',
        boxShadow: 'inset 0 0 0 2px #1a1a1a',
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: '#6E1423',
          borderBottom: '3px solid #1a1a1a',
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            background: '#F4D35E',
            boxShadow: 'inset 0 0 0 2px #1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 800,
            color: '#6E1423',
          }}
        >
          MD
        </div>
        <div style={{ color: '#F4D35E', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          TRADING DESK · FLOOR
        </div>
        <div style={{ marginLeft: 'auto', color: '#f0c9c9', fontSize: 9 }}>
          pixel office · agents at desks
        </div>
      </div>

      <div style={{ padding: 8, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            position: 'relative',
            width: w,
            height: h,
            background: `
              repeating-linear-gradient(0deg, #3d4a3d 0 1px, transparent 1px 28px),
              repeating-linear-gradient(90deg, #3d4a3d 0 1px, transparent 1px 28px),
              #4a5a4a
            `,
            boxShadow: '4px 4px 0 #1a1a1a, inset 0 0 0 2px #1a1a1a',
            imageRendering: 'pixelated',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: TILE * 3.5,
              top: TILE * 3.2,
              width: TILE * 5,
              height: TILE * 1.6,
              background: '#6E1423',
              opacity: 0.35,
              boxShadow: 'inset 0 0 0 2px #1a1a1a',
            }}
          />

          {DESK_LAYOUT.map((d) => (
            <DeskStation
              key={d.id}
              id={d.id}
              col={d.col}
              row={d.row}
              status={agentStatus[d.id]}
              lastBrief={lastBrief[d.id]}
              selected={selected === d.id}
              onSelect={() => onSelect(d.id)}
            />
          ))}

          {envelopes.map((e) => (
            <FlyingEnvelope
              key={e.key}
              from={pos(e.fromId)}
              to={pos(e.toId)}
              onDone={() => setEnvelopes((list) => list.filter((x) => x.key !== e.key))}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          padding: '4px 10px 8px',
          fontSize: 9,
          color: '#848e9c',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span>
          <span style={{ color: '#F4D35E' }}>●</span> thinking
        </span>
        <span>
          <span style={{ color: '#0ecb81' }}>●</span> ready
        </span>
        <span>
          <span style={{ color: '#f6465d' }}>●</span> error
        </span>
        <span style={{ color: '#F4D35E' }}>✉</span> hive mail
      </div>
    </div>
  )
}
