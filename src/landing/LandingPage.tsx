/**
 * Professional marketing landing — shown before terminal access.
 * CTA opens credential gate; on success the parent mounts TerminalApp.
 */
import { useEffect, useRef, useState } from 'react'

type LandingPageProps = {
  onRequestAccess: () => void
  onGuest?: () => void
  brandName?: string
}

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

export function LandingPage({
  onRequestAccess,
  onGuest,
  brandName = 'NACS Lab Terminal',
}: LandingPageProps) {
  const heroChartRef = useRef<HTMLCanvasElement>(null)
  const xrayRef = useRef<HTMLCanvasElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    drawHeroChart(heroChartRef.current)
    drawXrayStrip(xrayRef.current)
  }, [])

  return (
    <div className="min-h-screen text-[#eaecef] overflow-x-hidden" style={{ background: '#06090d' }}>
      <nav
        className="fixed top-0 inset-x-0 z-50 transition-[border-color,background] duration-300"
        style={{
          backdropFilter: 'blur(16px)',
          background: scrolled ? 'rgba(6,9,13,0.9)' : 'rgba(6,9,13,0.72)',
          borderBottom: scrolled ? '1px solid #1a2230' : '1px solid transparent',
        }}
      >
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-[4%]">
          <div className="flex items-center gap-2.5 font-extrabold tracking-wide text-[15px]">
            <span
              className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-black text-[#1a1a1a]"
              style={{
                background: 'linear-gradient(135deg,#F4D35E,#e0a800)',
                boxShadow: '0 0 18px rgba(244,211,94,0.35)',
              }}
            >
              N
            </span>
            {brandName}
          </div>
          <div className="hidden items-center gap-7 text-[13px] font-medium text-[#848e9c] sm:flex">
            <a href="#features" className="hover:text-[#eaecef] transition-colors">Features</a>
            <a href="#xray" className="hover:text-[#eaecef] transition-colors">X-Ray</a>
            <a href="#desk" className="hover:text-[#eaecef] transition-colors">Desk</a>
            <button
              type="button"
              onClick={onRequestAccess}
              className="rounded-lg px-4 py-2 text-[13px] font-bold text-[#1a1a1a]"
              style={{ background: 'linear-gradient(90deg,#F4D35E,#e0a800)' }}
            >
              Accedi
            </button>
          </div>
          <button
            type="button"
            onClick={onRequestAccess}
            className="rounded-lg px-3.5 py-2 text-[12px] font-bold text-[#1a1a1a] sm:hidden"
            style={{ background: 'linear-gradient(90deg,#F4D35E,#e0a800)' }}
          >
            Accedi
          </button>
        </div>
      </nav>

      <header className="relative overflow-hidden pt-[140px] pb-16">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(244,211,94,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 60%, rgba(14,203,129,0.06), transparent 50%)',
          }}
        />
        <div className="relative mx-auto max-w-[780px] px-[4%] text-center">
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{
              background: 'rgba(244,211,94,0.08)',
              borderColor: 'rgba(244,211,94,0.25)',
              color: '#F4D35E',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#0ecb81]" style={{ boxShadow: '0 0 8px #0ecb81' }} />
            Live · Binance · Institutional Grade
          </div>

          <h1 className="mb-5 text-[clamp(2.2rem,5.2vw,3.5rem)] font-extrabold leading-[1.12] tracking-[-0.03em]">
            Il terminale di trading
            <br />
            <span
              style={{
                background: 'linear-gradient(90deg,#F4D35E,#f0c14b)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              che vede i order block
            </span>
          </h1>

          <p className="mx-auto mb-9 max-w-[540px] text-[17px] leading-relaxed text-[#848e9c]">
            Order Block X-Ray, Trading Desk autonomo, Ops Scanner e grafici professionali.
            Workspace multi-panel costruito per sessioni serie.
          </p>

          <div className="mb-14 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onRequestAccess}
              className="rounded-[10px] px-7 py-3.5 text-[15px] font-bold text-[#1a1a1a] shadow-[0_4px_24px_rgba(244,211,94,0.28)]"
              style={{ background: 'linear-gradient(90deg,#F4D35E,#e0a800)' }}
            >
              Accedi al Terminal →
            </button>
            {onGuest && (
              <button
                type="button"
                onClick={onGuest}
                className="rounded-[10px] border border-[#2a3140] bg-white/[0.03] px-7 py-3.5 text-[15px] font-bold text-[#eaecef]"
              >
                Continua come guest
              </button>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-8 border-t border-[#1a2230] pt-8">
            {[
              { v: 'BOS+', l: 'Body Zone OB' },
              { v: 'X-Ray', l: 'Sector Breadth' },
              { v: '3D', l: 'Trading Desk' },
              { v: '60s', l: 'Live Refresh' },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <div className="font-mono text-[22px] font-bold text-[#F4D35E]">{s.v}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-[#5e6673]">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto mt-12 max-w-[1120px] px-[4%]">
          <div
            className="overflow-hidden rounded-2xl border border-[#1a2230]"
            style={{
              background: '#0b0f14',
              boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 50px rgba(244,211,94,0.12)',
            }}
          >
            <div className="flex items-center gap-2 border-b border-[#1a2230] bg-[#0a0e13] px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f6465d]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#F4D35E]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#0ecb81]" />
              <span className="ml-3 font-mono text-[10px] tracking-wide text-[#5e6673]">
                ORDER BLOCK · X-RAY · PICKS · 5m
              </span>
            </div>
            <div className="grid min-h-[280px] grid-cols-1 md:grid-cols-[1fr_260px]">
              <div className="relative bg-[#080b0f] p-3">
                <canvas ref={heroChartRef} width={700} height={260} className="h-full w-full" />
              </div>
              <div className="flex flex-col gap-2 border-t border-[#1a2230] bg-[#0a0e13] p-4 md:border-l md:border-t-0">
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#5e6673]">Picks · Bullish</div>
                {[
                  ['SOLUSDT', '+4.82%', true],
                  ['AVAXUSDT', '+3.41%', true],
                  ['NEARUSDT', '+2.97%', true],
                ].map(([sym, pct, up]) => (
                  <div
                    key={String(sym)}
                    className="flex items-center justify-between rounded-lg border border-[#1a2230] bg-[#0e1319] px-2.5 py-2 font-mono text-[12px]"
                  >
                    <span>{sym}</span>
                    <span style={{ color: up ? '#0ecb81' : '#f6465d' }}>{pct}</span>
                  </div>
                ))}
                <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[#5e6673]">Leading sector</div>
                {[
                  ['L1', '+1.84%', true],
                  ['AI', '+1.22%', true],
                  ['DeFi', '−0.41%', false],
                ].map(([sym, pct, up]) => (
                  <div
                    key={String(sym)}
                    className="flex items-center justify-between rounded-lg border border-[#1a2230] bg-[#0e1319] px-2.5 py-2 font-mono text-[12px]"
                  >
                    <span>{sym}</span>
                    <span style={{ color: up ? '#0ecb81' : '#f6465d' }}>{pct}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section id="features" className="py-20">
        <div className="mx-auto max-w-[1120px] px-[4%]">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F4D35E]">Capabilities</div>
          <h2 className="mb-3 text-[clamp(1.7rem,3.2vw,2.2rem)] font-extrabold tracking-[-0.02em]">
            Tutto quello che serve in un desk
          </h2>
          <p className="mb-12 max-w-[520px] text-[#848e9c]">
            Pannelli specializzati, dati pubblici Binance, detection precisa e UI pensata per sessioni lunghe.
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: '▣', title: 'Order Block X-Ray', body: 'BOS + body zone, mitigation, quality score. Sector strip lagging→leading, rank bars e flow multi-linea.' },
              { icon: '◆', title: 'Trading Desk 3D', body: 'Ufficio virtuale con agenti autonomi, monitor live e orchestrazione. Flusso operativo in tempo reale.' },
              { icon: '◎', title: 'Ops Scanner', body: 'Setup operativi filtrati per liquidità, strength e sector cap. Solo i setup puliti restano in board.' },
              { icon: '▤', title: 'Grafici istituzionali', body: 'Lightweight Charts, volume profile, deep print, zone overlay, VWAP e livelli Z / S1 / R1 / R2.' },
              { icon: '◈', title: 'Multi-panel Workspace', body: 'Grid layout ridimensionabile. Ogni pannello indipendente e sincronizzato sul simbolo primario.' },
              { icon: '⚡', title: 'Dati live Binance', body: 'Ticker 24h, klines e depth pubblici. Market breadth e order block in lettura senza API key.' },
            ].map((f) => (
              <article
                key={f.title}
                className="group relative overflow-hidden rounded-xl border border-[#1a2230] bg-[#0e1319] p-6 transition hover:-translate-y-0.5 hover:border-[rgba(244,211,94,0.35)]"
              >
                <div
                  className="mb-4 grid h-10 w-10 place-items-center rounded-[10px] border text-[18px]"
                  style={{ background: 'rgba(244,211,94,0.08)', borderColor: 'rgba(244,211,94,0.2)' }}
                >
                  {f.icon}
                </div>
                <h3 className="mb-2 text-[16px] font-bold">{f.title}</h3>
                <p className="text-[13px] leading-relaxed text-[#848e9c]">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="xray" className="py-16" style={{ background: 'linear-gradient(180deg,transparent,rgba(244,211,94,0.03),transparent)' }}>
        <div className="mx-auto grid max-w-[1120px] items-center gap-12 px-[4%] md:grid-cols-2">
          <div className="overflow-hidden rounded-[14px] border border-[#1a2230] bg-[#0b0f14]" style={{ aspectRatio: '16/10' }}>
            <canvas ref={xrayRef} width={520} height={300} className="h-full w-full" />
          </div>
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F4D35E]">Order Block</div>
            <h3 className="mb-3 text-[22px] font-extrabold">X-Ray di mercato in un colpo d’occhio</h3>
            <p className="mb-5 text-[14px] leading-relaxed text-[#848e9c]">
              Sector strip da lagging a leading, rank list con barre glowing e flow chart multi-linea.
              I PICK rispettano sector cap, liquidità e purezza del movimento.
            </p>
            <ul className="space-y-2.5 text-[14px] text-[#848e9c]">
              {[
                'Body zone istituzionale + break of structure',
                'Mitigation: fresh / tested / mitigated / broken',
                'Quality score e R:R basato su ATR',
                'Board BULLISH / BEARISH / PICKS',
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="font-bold text-[#0ecb81]">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="desk" className="py-16">
        <div className="mx-auto grid max-w-[1120px] items-center gap-12 px-[4%] md:grid-cols-2">
          <div className="order-2 md:order-1">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F4D35E]">Trading Desk</div>
            <h3 className="mb-3 text-[22px] font-extrabold">Agenti autonomi sul tuo desk</h3>
            <p className="mb-5 text-[14px] leading-relaxed text-[#848e9c]">
              Ufficio 3D dove scanner, analyst e risk agent collaborano. Monitor collegati ai pannelli,
              orchestrazione e loop di autonomia configurabile.
            </p>
            <ul className="space-y-2.5 text-[14px] text-[#848e9c]">
              {[
                'Ruoli specializzati e hand-off chiari',
                'Monitor con chart e depth live',
                'Orchestrator con policy di rischio',
                'Workspace sincronizzato sul simbolo primario',
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="font-bold text-[#0ecb81]">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div
            className="order-1 flex flex-col items-center justify-center gap-4 overflow-hidden rounded-[14px] border border-[#1a2230] bg-[#0b0f14] p-8 md:order-2"
            style={{ aspectRatio: '16/10' }}
          >
            <div className="text-[10px] tracking-[0.12em] text-[#F4D35E]">TRADING DESK · AGENTS ONLINE</div>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { n: 'Scanner', c: '#0ecb81', s: 'LIVE' },
                { n: 'Analyst', c: '#F4D35E', s: 'OB · 5m' },
                { n: 'Risk', c: '#3b82f6', s: 'R:R 1.6×' },
              ].map((a) => (
                <div key={a.n} className="min-w-[110px] rounded-[10px] border border-[#1a2230] bg-[#0e1319] px-4 py-3 text-center">
                  <div className="text-[13px] font-bold" style={{ color: a.c }}>{a.n}</div>
                  <div className="mt-1 text-[10px] text-[#5e6673]">{a.s}</div>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-[#5e6673]">Office floor · monitors · autonomy loop</div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-20">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(244,211,94,0.1), transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-[680px] px-[4%] text-center">
          <div
            className="rounded-[20px] border px-8 py-12"
            style={{
              background: '#0e1319',
              borderColor: 'rgba(244,211,94,0.3)',
              boxShadow: '0 0 60px rgba(244,211,94,0.15)',
            }}
          >
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F4D35E]">Ready</div>
            <h2 className="mb-3 text-[26px] font-extrabold">Inserisci le credenziali e apri il desk</h2>
            <p className="mb-7 text-[14px] text-[#848e9c]">
              Dalla landing passi al login sicuro. Dopo l’autenticazione entri nel terminal completo
              con trading, bots e chiavi live.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={onRequestAccess}
                className="rounded-[10px] px-7 py-3.5 text-[15px] font-bold text-[#1a1a1a]"
                style={{ background: 'linear-gradient(90deg,#F4D35E,#e0a800)' }}
              >
                Accedi con credenziali
              </button>
              {onGuest && (
                <button
                  type="button"
                  onClick={onGuest}
                  className="rounded-[10px] border border-[#2a3140] bg-white/[0.03] px-7 py-3.5 text-[#eaecef]"
                >
                  Solo lettura (guest)
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#1a2230] py-10">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-6 px-[4%]">
          <div className="flex items-center gap-2.5 font-extrabold tracking-wide">
            <span
              className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-black text-[#1a1a1a]"
              style={{ background: 'linear-gradient(135deg,#F4D35E,#e0a800)' }}
            >
              N
            </span>
            {brandName}
          </div>
          <div className="flex gap-6 text-[13px] text-[#5e6673]">
            <a href="#features" className="hover:text-[#848e9c]">Features</a>
            <a href="#xray" className="hover:text-[#848e9c]">X-Ray</a>
            <a href="#desk" className="hover:text-[#848e9c]">Desk</a>
          </div>
        </div>
        <p className="mt-6 text-center text-[12px] text-[#5e6673]">
          © {new Date().getFullYear()} {brandName} · Dati pubblici Binance · Built for professional traders
        </p>
      </footer>
    </div>
  )
}

function drawHeroChart(c: HTMLCanvasElement | null) {
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const w = c.width
  const h = c.height
  ctx.fillStyle = '#080b0f'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  for (let i = 0; i <= 6; i++) {
    const y = (h * i) / 6
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  const zy1 = h * 0.42
  const zy2 = h * 0.52
  const zg = ctx.createLinearGradient(0, zy1, 0, zy2)
  zg.addColorStop(0, 'rgba(244,211,94,0.06)')
  zg.addColorStop(0.5, 'rgba(244,211,94,0.22)')
  zg.addColorStop(1, 'rgba(244,211,94,0.06)')
  ctx.fillStyle = zg
  ctx.fillRect(0, zy1, w, zy2 - zy1)
  ctx.strokeStyle = 'rgba(244,211,94,0.55)'
  ctx.strokeRect(0.5, zy1, w - 1, zy2 - zy1)
  const pts = 48
  ctx.beginPath()
  for (let i = 0; i < pts; i++) {
    const t = i / (pts - 1)
    const x = 8 + t * (w - 16)
    const y = h * 0.55 - Math.sin(t * 4.2) * 28 - t * 18 + Math.sin(t * 17) * 6
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = '#0ecb81'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.font = '11px ui-monospace, monospace'
  ctx.fillStyle = '#F4D35E'
  ctx.fillText('Z', w - 28, zy1 + 14)
  ctx.fillStyle = '#0ecb81'
  ctx.fillText('R1', w - 34, h * 0.28)
  ctx.fillStyle = '#f6465d'
  ctx.fillText('S1', w - 34, h * 0.62)
}

function drawXrayStrip(c: HTMLCanvasElement | null) {
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const w = c.width
  const h = c.height
  ctx.fillStyle = '#06090d'
  ctx.fillRect(0, 0, w, h)
  ctx.font = '10px system-ui, sans-serif'
  ctx.fillStyle = '#5e6673'
  ctx.fillText('LAGGING SECTOR', 16, 22)
  ctx.fillStyle = '#f6465d'
  ctx.font = 'bold 11px ui-monospace, monospace'
  ctx.fillText('MEME  −1.24%', 130, 22)
  ctx.fillStyle = '#5e6673'
  ctx.font = '10px system-ui, sans-serif'
  ctx.fillText('LEADING SECTOR', w - 200, 22)
  ctx.fillStyle = '#0ecb81'
  ctx.font = 'bold 11px ui-monospace, monospace'
  ctx.fillText('L1  +1.84%', w - 90, 22)
  const midY = 52
  const rail = ctx.createLinearGradient(20, 0, w - 20, 0)
  rail.addColorStop(0, 'rgba(246,70,93,0.7)')
  rail.addColorStop(0.5, 'rgba(255,255,255,0.15)')
  rail.addColorStop(1, 'rgba(14,203,129,0.7)')
  ctx.strokeStyle = rail
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(24, midY)
  ctx.lineTo(w - 24, midY)
  ctx.stroke()
  for (let i = 0; i < 22; i++) {
    const t = i / 21
    const x = 28 + t * (w - 56)
    const y = midY + Math.sin(i * 1.7) * 7
    const r = 2 + (i % 3) * 0.8
    const col = t < 0.45 ? '#f6465d' : t > 0.55 ? '#0ecb81' : '#848e9c'
    ctx.beginPath()
    ctx.fillStyle = col
    ctx.globalAlpha = 0.55 + t * 0.4
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ;[[24, '#f6465d'], [w - 24, '#0ecb81']].forEach(([x, col]) => {
    ctx.beginPath()
    ctx.fillStyle = String(col)
    ctx.shadowColor = String(col)
    ctx.shadowBlur = 14
    ctx.arc(Number(x), midY, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  })
  const sectors = [
    { n: 'L1', p: 1.84 },
    { n: 'AI', p: 1.22 },
    { n: 'INFRA', p: 0.71 },
    { n: 'DEFI', p: -0.41 },
    { n: 'MEME', p: -1.24 },
  ]
  sectors.forEach((s, i) => {
    const y = 90 + i * 28
    const up = s.p >= 0
    ctx.fillStyle = up ? '#0ecb81' : '#f6465d'
    ctx.font = 'bold 11px ui-monospace, monospace'
    ctx.fillText(s.n, 20, y + 10)
    const barW = Math.min(160, Math.abs(s.p) * 70)
    ctx.fillStyle = up ? '#0ecb81' : '#f6465d'
    ctx.fillRect(80, y, barW, 12)
    ctx.fillText(fmtPct(s.p), 80 + barW + 10, y + 10)
  })
  for (let s = 0; s < 6; s++) {
    ctx.beginPath()
    for (let i = 0; i < 30; i++) {
      const t = i / 29
      const x = 300 + t * 200
      const y = 120 + Math.sin(t * 5 + s) * 18 + t * t * (-20 - s * 4)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = `rgba(14,203,129,${0.25 + s * 0.08})`
    ctx.lineWidth = s === 0 ? 2 : 1.2
    ctx.stroke()
  }
}

export default LandingPage
