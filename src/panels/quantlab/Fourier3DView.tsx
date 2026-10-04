import { useEffect, useMemo, useRef, useState } from 'react'
import { computeDft, epicycleRadii } from '@/analysis/fourier'
import type { Candle } from '@/types'

function project(
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
  scale: number,
  cx: number,
  cy: number
) {
  const cyw = Math.cos(yaw)
  const syw = Math.sin(yaw)
  const cpi = Math.cos(pitch)
  const spi = Math.sin(pitch)
  const x1 = x * cyw - z * syw
  const z1 = x * syw + z * cyw
  const y1 = y * cpi - z1 * spi
  const z2 = y * spi + z1 * cpi
  const persp = 2.2 / (2.2 + z2 * 0.01)
  return { x: cx + x1 * scale * persp, y: cy - y1 * scale * persp, z: z2 }
}

export function Fourier3DView({ candles, harmonics }: { candles: Candle[]; harmonics: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [yaw, setYaw] = useState(0.6)
  const [pitch, setPitch] = useState(0.45)
  const [auto, setAuto] = useState(true)
  const tRef = useRef(0)

  const closes = useMemo(() => candles.map((c) => c.close).slice(-256), [candles])
  const dft = useMemo(() => computeDft(closes, 48), [closes])
  const epis = useMemo(() => epicycleRadii(dft, Math.min(12, harmonics)), [dft, harmonics])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      tRef.current += 0.018
      if (auto) setYaw((y) => y + 0.008)
      const canvas = canvasRef.current
      if (canvas) paint(canvas)
      raf = requestAnimationFrame(loop)
    }
    const paint = (canvas: HTMLCanvasElement) => {
      const parent = canvas.parentElement
      const w = parent?.clientWidth || 640
      const h = Math.max(280, parent?.clientHeight || 320)
      const dpr = devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#070a0f'
      ctx.fillRect(0, 0, w, h)
      const cx = w * 0.42
      const cy = h * 0.55
      const scale = Math.min(w, h) * 0.12

      ctx.strokeStyle = 'rgba(30,35,41,0.7)'
      for (let i = -5; i <= 5; i++) {
        const a = project(-5, 0, i, yaw, pitch, scale, cx, cy)
        const b = project(5, 0, i, yaw, pitch, scale, cx, cy)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        const c = project(i, 0, -5, yaw, pitch, scale, cx, cy)
        const d = project(i, 0, 5, yaw, pitch, scale, cx, cy)
        ctx.beginPath()
        ctx.moveTo(c.x, c.y)
        ctx.lineTo(d.x, d.y)
        ctx.stroke()
      }

      const maxA = Math.max(...epis.map((e) => e.amp), 1)
      epis.forEach((e, rank) => {
        const y = (rank + 1) * 0.55
        const r = 0.4 + (e.amp / maxA) * 2.2
        ctx.strokeStyle = `rgba(91,141,239,${0.35 + 0.5 * (1 - rank / Math.max(epis.length, 1))})`
        ctx.beginPath()
        for (let a = 0; a <= 64; a++) {
          const th = (a / 64) * Math.PI * 2
          const p = project(r * Math.cos(th), y, r * Math.sin(th), yaw, pitch, scale, cx, cy)
          if (a === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        ctx.closePath()
        ctx.stroke()
      })

      let x = 0
      let z = 0
      const y0 = 0.15
      for (let i = 0; i < epis.length; i++) {
        const e = epis[i]
        const r = (e.amp / maxA) * 2.5
        const ang = e.phase + (2 * Math.PI * e.k * tRef.current) / Math.max(dft.n, 1)
        ctx.strokeStyle = 'rgba(240,185,11,0.25)'
        ctx.beginPath()
        for (let a = 0; a <= 48; a++) {
          const th = (a / 48) * Math.PI * 2
          const p = project(x + r * Math.cos(th), y0, z + r * Math.sin(th), yaw, pitch, scale, cx, cy)
          if (a === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
        const nx = x + r * Math.cos(ang)
        const nz = z + r * Math.sin(ang)
        const p0 = project(x, y0, z, yaw, pitch, scale, cx, cy)
        const p1 = project(nx, y0, nz, yaw, pitch, scale, cx, cy)
        ctx.strokeStyle = 'rgba(14,203,129,0.9)'
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
        x = nx
        z = nz
      }
      const tip = project(x, y0, z, yaw, pitch, scale, cx, cy)
      ctx.fillStyle = '#f0b90b'
      ctx.beginPath()
      ctx.arc(tip.x, tip.y, 3.5, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#848e9c'
      ctx.font = '11px monospace'
      ctx.fillText('HARMONIC STACK · Re / Im / rank', 12, 20)
      ctx.fillText(`${epis.length} epicycles · DFT n=${dft.n}`, 12, 36)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [epis, dft.n, yaw, pitch, auto])

  return (
    <div className="flex flex-col h-full min-h-0 text-[11px]">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#2b3139] shrink-0">
        <label className="flex items-center gap-1 text-[#848e9c]">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          auto-rotate
        </label>
        <span className="text-[#5e6673]">yaw</span>
        <input type="range" min={-3} max={3} step={0.05} value={yaw} onChange={(e) => setYaw(+e.target.value)} className="w-24 accent-[#f0b90b]" />
        <span className="text-[#5e6673]">pitch</span>
        <input type="range" min={0.1} max={1.2} step={0.05} value={pitch} onChange={(e) => setPitch(+e.target.value)} className="w-24 accent-[#f0b90b]" />
      </div>
      <div className="flex-1 min-h-[280px] relative">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  )
}
