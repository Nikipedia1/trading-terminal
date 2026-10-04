import { useEffect, useMemo, useRef, useState } from 'react'
import { computeDft, reconstruct, forecastHalf, epicycleRadii } from '@/analysis/fourier'
import type { Candle } from '@/types'

interface Props {
  candles: Candle[]
  harmonics: number
  onHarmonics: (n: number) => void
}

export function FourierView({ candles, harmonics, onHarmonics }: Props) {
  const priceRef = useRef<HTMLCanvasElement>(null)
  const epiRef = useRef<HTMLCanvasElement>(null)
  const [t, setT] = useState(0)
  const closes = useMemo(() => candles.map((c) => c.close).slice(-256), [candles])
  const dft = useMemo(() => computeDft(closes, 64), [closes])
  const recon = useMemo(() => reconstruct(dft, dft.n, harmonics), [dft, harmonics])
  const fc = useMemo(() => forecastHalf(closes, harmonics), [closes, harmonics])

  useEffect(() => {
    let id = 0
    const loop = () => {
      setT((x) => x + 0.02)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const canvas = priceRef.current
    if (!canvas || dft.n < 8) return
    const w = canvas.parentElement?.clientWidth || 500
    const h = 180
    const dpr = devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0b0e11'
    ctx.fillRect(0, 0, w, h)
    const series = closes.slice(-dft.n)
    const vals = [...series, ...recon]
    let min = Math.min(...vals)
    let max = Math.max(...vals)
    const pad = (max - min) * 0.08 || 1
    min -= pad
    max += pad
    const xOf = (i: number) => (i / (dft.n - 1)) * (w - 16) + 8
    const yOf = (v: number) => h - 10 - ((v - min) / (max - min)) * (h - 20)
    ctx.strokeStyle = 'rgba(132,142,156,0.85)'
    ctx.beginPath()
    series.forEach((v, i) => (i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v))))
    ctx.stroke()
    ctx.strokeStyle = '#0ecb81'
    ctx.beginPath()
    recon.forEach((v, i) => (i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v))))
    ctx.stroke()
    ctx.fillStyle = '#848e9c'
    ctx.font = '10px monospace'
    ctx.fillText(`price vs recon (${harmonics} harmonics)`, 10, 14)
  }, [closes, dft, recon, harmonics])

  useEffect(() => {
    const canvas = epiRef.current
    if (!canvas) return
    const w = canvas.parentElement?.clientWidth || 280
    const h = 200
    const dpr = devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0b0e11'
    ctx.fillRect(0, 0, w, h)
    const epis = epicycleRadii(dft, Math.min(8, harmonics))
    if (!epis.length) return
    const maxA = Math.max(...epis.map((e) => e.amp), 1)
    const scale = (Math.min(w, h) * 0.35) / maxA
    let x = w * 0.4
    let y = h * 0.5
    for (const e of epis) {
      const r = e.amp * scale
      const ang = e.phase + (2 * Math.PI * e.k * t) / Math.max(dft.n, 1)
      ctx.strokeStyle = 'rgba(91,141,239,0.35)'
      ctx.beginPath()
      ctx.arc(x, y, Math.max(2, r), 0, Math.PI * 2)
      ctx.stroke()
      const nx = x + r * Math.cos(ang)
      const ny = y + r * Math.sin(ang)
      ctx.strokeStyle = 'rgba(14,203,129,0.85)'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(nx, ny)
      ctx.stroke()
      x = nx
      y = ny
    }
    ctx.fillStyle = '#f0b90b'
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#848e9c'
    ctx.font = '10px monospace'
    ctx.fillText(`${Math.min(8, harmonics)} spinning vectors`, 10, 14)
  }, [dft, harmonics, t])

  return (
    <div className="space-y-2 p-2 text-[11px] text-[#eaecef]">
      <div className="flex items-center gap-2">
        <span className="text-[#848e9c]">Harmonics</span>
        <input
          type="range"
          min={1}
          max={16}
          value={harmonics}
          onChange={(e) => onHarmonics(+e.target.value)}
          className="w-32 accent-[#f0b90b]"
        />
        <span className="text-[#f0b90b] font-mono">{harmonics}</span>
        <span className="text-[#5e6673] ml-auto">DFT n={dft.n}</span>
      </div>
      <div className="rounded-lg border border-[#2b3139] overflow-hidden">
        <canvas ref={priceRef} className="w-full block" />
      </div>
      <div className="rounded-lg border border-[#2b3139] overflow-hidden">
        <canvas ref={epiRef} className="w-full block" />
      </div>
      <p className="text-[10px] text-[#5e6673]">
        x(t)=Σ Aₖ cos(2πfₖt+φₖ) · research only · top k={dft.top[0]?.k ?? '—'} · forecast pts{" "}
        {fc.forecast.length}
      </p>
    </div>
  )
}
