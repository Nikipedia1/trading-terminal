/** Canvas helpers for landing mocks */
function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

export function drawHeroChart(c: HTMLCanvasElement | null) {
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const w = c.width, h = c.height
  ctx.fillStyle = '#080b0f'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  for (let i = 0; i <= 6; i++) {
    const y = (h * i) / 6
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
  const zy1 = h * 0.42, zy2 = h * 0.52
  const zg = ctx.createLinearGradient(0, zy1, 0, zy2)
  zg.addColorStop(0, 'rgba(244,211,94,0.06)'); zg.addColorStop(0.5, 'rgba(244,211,94,0.22)'); zg.addColorStop(1, 'rgba(244,211,94,0.06)')
  ctx.fillStyle = zg; ctx.fillRect(0, zy1, w, zy2 - zy1)
  ctx.strokeStyle = 'rgba(244,211,94,0.55)'; ctx.strokeRect(0.5, zy1, w - 1, zy2 - zy1)
  ctx.beginPath()
  for (let i = 0; i < 48; i++) {
    const t = i / 47
    const x = 8 + t * (w - 16)
    const y = h * 0.55 - Math.sin(t * 4.2) * 28 - t * 18 + Math.sin(t * 17) * 6
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = '#0ecb81'; ctx.lineWidth = 2; ctx.stroke()
  ctx.font = '11px ui-monospace, monospace'
  ctx.fillStyle = '#F4D35E'; ctx.fillText('Z', w - 28, zy1 + 14)
  ctx.fillStyle = '#0ecb81'; ctx.fillText('R1', w - 34, h * 0.28)
  ctx.fillStyle = '#f6465d'; ctx.fillText('S1', w - 34, h * 0.62)
}

export function drawXrayStrip(c: HTMLCanvasElement | null) {
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const w = c.width, h = c.height
  ctx.fillStyle = '#06090d'; ctx.fillRect(0, 0, w, h)
  ctx.font = '10px system-ui, sans-serif'; ctx.fillStyle = '#5e6673'; ctx.fillText('LAGGING SECTOR', 16, 22)
  ctx.fillStyle = '#f6465d'; ctx.font = 'bold 11px ui-monospace, monospace'; ctx.fillText('MEME  −1.24%', 130, 22)
  ctx.fillStyle = '#5e6673'; ctx.font = '10px system-ui, sans-serif'; ctx.fillText('LEADING SECTOR', w - 200, 22)
  ctx.fillStyle = '#0ecb81'; ctx.font = 'bold 11px ui-monospace, monospace'; ctx.fillText('L1  +1.84%', w - 90, 22)
  const midY = 52
  const rail = ctx.createLinearGradient(20, 0, w - 20, 0)
  rail.addColorStop(0, 'rgba(246,70,93,0.7)'); rail.addColorStop(0.5, 'rgba(255,255,255,0.15)'); rail.addColorStop(1, 'rgba(14,203,129,0.7)')
  ctx.strokeStyle = rail; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(24, midY); ctx.lineTo(w - 24, midY); ctx.stroke()
  for (let i = 0; i < 22; i++) {
    const t = i / 21, x = 28 + t * (w - 56), y = midY + Math.sin(i * 1.7) * 7
    ctx.beginPath(); ctx.fillStyle = t < 0.45 ? '#f6465d' : t > 0.55 ? '#0ecb81' : '#848e9c'
    ctx.globalAlpha = 0.55 + t * 0.4; ctx.arc(x, y, 2 + (i % 3) * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
  }
  ;[[24, '#f6465d'], [w - 24, '#0ecb81']].forEach(([x, col]) => {
    ctx.beginPath(); ctx.fillStyle = String(col); ctx.shadowColor = String(col); ctx.shadowBlur = 14
    ctx.arc(Number(x), midY, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0
  })
  ;[{ n: 'L1', p: 1.84 }, { n: 'AI', p: 1.22 }, { n: 'INFRA', p: 0.71 }, { n: 'DEFI', p: -0.41 }, { n: 'MEME', p: -1.24 }].forEach((s, i) => {
    const y = 90 + i * 28, up = s.p >= 0
    ctx.fillStyle = up ? '#0ecb81' : '#f6465d'; ctx.font = 'bold 11px ui-monospace, monospace'
    ctx.fillText(s.n, 20, y + 10)
    const barW = Math.min(160, Math.abs(s.p) * 70)
    ctx.fillRect(80, y, barW, 12); ctx.fillText(fmtPct(s.p), 80 + barW + 10, y + 10)
  })
  for (let s = 0; s < 6; s++) {
    ctx.beginPath()
    for (let i = 0; i < 30; i++) {
      const t = i / 29, x = 300 + t * 200, y = 120 + Math.sin(t * 5 + s) * 18 + t * t * (-20 - s * 4)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = `rgba(14,203,129,${0.25 + s * 0.08})`; ctx.lineWidth = s === 0 ? 2 : 1.2; ctx.stroke()
  }
}
