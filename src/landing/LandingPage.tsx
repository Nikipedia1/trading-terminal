/**
 * NACS Lab Terminal — professional marketing landing (pre-auth).
 */
import { useEffect, useRef, useState } from 'react'
import { FEATURES, STEPS, DATA_POINTS, FAQ, PLANS } from './LandingCopy'
import { drawHeroChart, drawXrayStrip } from './LandingCharts'

type LandingPageProps = {
  onRequestAccess: () => void
  onGuest?: () => void
  brandName?: string
}

export function LandingPage({
  onRequestAccess,
  onGuest,
  brandName = 'NACS Lab Terminal',
}: LandingPageProps) {
  const heroChartRef = useRef<HTMLCanvasElement>(null)
  const xrayRef = useRef<HTMLCanvasElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

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
          background: scrolled ? 'rgba(6,9,13,0.92)' : 'rgba(6,9,13,0.75)',
          borderBottom: scrolled ? '1px solid #1a2230' : '1px solid transparent',
        }}
      >
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-[4%]">
          <div className="flex items-center gap-2.5 font-extrabold tracking-wide text-[15px]">
            <span
              className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-black text-[#1a1a1a]"
              style={{ background: 'linear-gradient(135deg,#F4D35E,#e0a800)', boxShadow: '0 0 18px rgba(244,211,94,0.35)' }}
            >
              N
            </span>
            <span className="hidden sm:inline">{brandName}</span>
            <span className="sm:hidden">NACS Lab</span>
          </div>
          <div className="hidden items-center gap-6 text-[13px] font-medium text-[#848e9c] md:flex">
            <a href="#features" className="hover:text-[#eaecef] transition-colors">Features</a>
            <a href="#how" className="hover:text-[#eaecef] transition-colors">Come funziona</a>
            <a href="#data" className="hover:text-[#eaecef] transition-colors">Dati</a>
            <a href="#pricing" className="hover:text-[#eaecef] transition-colors">Prezzi</a>
            <a href="#faq" className="hover:text-[#eaecef] transition-colors">FAQ</a>
            <button type="button" onClick={onRequestAccess} className="rounded-lg px-4 py-2 text-[13px] font-bold text-[#1a1a1a]" style={{ background: 'linear-gradient(90deg,#F4D35E,#e0a800)' }}>
              Accedi
            </button>
          </div>
          <button type="button" onClick={onRequestAccess} className="rounded-lg px-3.5 py-2 text-[12px] font-bold text-[#1a1a1a] md:hidden" style={{ background: 'linear-gradient(90deg,#F4D35E,#e0a800)' }}>
            Accedi
          </button>
        </div>
      </nav>

      <header className="relative overflow-hidden pt-[130px] pb-14">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(244,211,94,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 85% 55%, rgba(14,203,129,0.06), transparent 50%)' }} />
        <div className="relative mx-auto max-w-[800px] px-[4%] text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ background: 'rgba(244,211,94,0.08)', borderColor: 'rgba(244,211,94,0.25)', color: '#F4D35E' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#0ecb81]" style={{ boxShadow: '0 0 8px #0ecb81' }} />
            Blockchain Trading Terminal · v0.2
          </div>
          <h1 className="mb-4 text-[clamp(2.1rem,5vw,3.4rem)] font-extrabold leading-[1.12] tracking-[-0.03em]">
            {brandName}
            <br />
            <span style={{ background: 'linear-gradient(90deg,#F4D35E,#f0c14b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              desk multi-panel per structure & flow
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-[560px] text-[16px] leading-relaxed text-[#848e9c]">
            Order Block X-Ray, Trading Desk con agenti, Ops Scanner, grafici istituzionali e paper trading.
            Dati live da Binance e KuCoin — zero dati finti, workspace pensato per sessioni serie.
          </p>
          <div className="mb-12 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={onRequestAccess} className="rounded-[10px] px-7 py-3.5 text-[15px] font-bold text-[#1a1a1a] shadow-[0_4px_24px_rgba(244,211,94,0.28)]" style={{ background: 'linear-gradient(90deg,#F4D35E,#e0a800)' }}>
              Accedi al Terminal →
            </button>
            {onGuest && (
              <button type="button" onClick={onGuest} className="rounded-[10px] border border-[#2a3140] bg-white/[0.03] px-7 py-3.5 text-[15px] font-bold text-[#eaecef]">
                Continua come guest
              </button>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-6 border-t border-[#1a2230] pt-8 sm:gap-10">
            {[
              { v: 'BOS+', l: 'Body Zone OB' },
              { v: 'X-Ray', l: 'Sector Breadth' },
              { v: 'L2', l: 'Real Book' },
              { v: 'Paper', l: 'Local Sim' },
              { v: '2', l: 'Exchanges' },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <div className="font-mono text-[20px] font-bold text-[#F4D35E]">{s.v}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-[#5e6673]">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto mt-12 max-w-[1120px] px-[4%]">
          <div className="overflow-hidden rounded-2xl border border-[#1a2230]" style={{ background: '#0b0f14', boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 50px rgba(244,211,94,0.1)' }}>
            <div className="flex items-center gap-2 border-b border-[#1a2230] bg-[#0a0e13] px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f6465d]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#F4D35E]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#0ecb81]" />
              <span className="ml-3 font-mono text-[10px] tracking-wide text-[#5e6673]">NACS LAB · ORDER BLOCK · X-RAY · PICKS · 5m</span>
            </div>
            <div className="grid min-h-[260px] grid-cols-1 md:grid-cols-[1fr_260px]">
              <div className="relative bg-[#080b0f] p-3">
                <canvas ref={heroChartRef} width={700} height={240} className="h-full w-full" />
              </div>
              <div className="flex flex-col gap-2 border-t border-[#1a2230] bg-[#0a0e13] p-4 md:border-l md:border-t-0">
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#5e6673]">Picks · Bullish</div>
                {[['SOLUSDT', '+4.82%'], ['AVAXUSDT', '+3.41%'], ['NEARUSDT', '+2.97%']].map(([sym, pct]) => (
                  <div key={sym} className="flex items-center justify-between rounded-lg border border-[#1a2230] bg-[#0e1319] px-2.5 py-2 font-mono text-[12px]">
                    <span>{sym}</span>
                    <span className="text-[#0ecb81]">{pct}</span>
                  </div>
                ))}
                <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[#5e6673]">Leading sector</div>
                {[['L1', '+1.84%', true], ['AI', '+1.22%', true], ['DeFi', '-0.41%', false]].map(([sym, pct, up]) => (
                  <div key={String(sym)} className="flex items-center justify-between rounded-lg border border-[#1a2230] bg-[#0e1319] px-2.5 py-2 font-mono text-[12px]">
                    <span>{sym}</span>
                    <span style={{ color: up ? '#0ecb81' : '#f6465d' }}>{pct as string}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="py-16 border-t border-[#1a2230]">
        <div className="mx-auto max-w-[1120px] px-[4%]">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F4D35E]">Perche NACS Lab</div>
              <h2 className="mb-4 text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-[-0.02em]">Un terminal, non un altro chart isolato</h2>
              <p className="mb-4 text-[14px] leading-relaxed text-[#848e9c]">
                NACS Lab Terminal unisce analisi di struttura (order block, BOS, zone), microstructure
                (book, aggressor trades, OFI) e un desk operativo multi-panel. Stessi vincoli di un desk serio:
                dati reali, moduli separati, overlay ancorati alle coordinate del chart.
              </p>
              <p className="text-[14px] leading-relaxed text-[#848e9c]">
                Non vendiamo segnali e non custodiamo fondi. E software di visualizzazione e, se vuoi,
                esecuzione self-directed con le tue chiavi exchange.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: 'Modulare', v: 'Data / render / tools / layout separati' },
                { k: 'Anti-film', v: 'Overlay solo su coordinate Lightweight Charts' },
                { k: 'Guest OK', v: 'Read-only senza account' },
                { k: 'Paper', v: 'Simulazione leverage e TP/SL locale' },
              ].map((x) => (
                <div key={x.k} className="rounded-xl border border-[#1a2230] bg-[#0e1319] p-4">
                  <div className="mb-1 text-[13px] font-bold text-[#F4D35E]">{x.k}</div>
                  <div className="text-[12px] text-[#848e9c] leading-snug">{x.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16">
        <div className="mx-auto max-w-[1120px] px-[4%]">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F4D35E]">Capabilities</div>
          <h2 className="mb-3 text-[clamp(1.6rem,3vw,2.1rem)] font-extrabold tracking-[-0.02em]">Moduli del desk</h2>
          <p className="mb-10 max-w-[540px] text-[#848e9c] text-[14px]">
            Ogni pannello e indipendente ma condivide simbolo, interval e feed. Aggiungi Order Block,
            Scanner, depth o paper quando ti servono.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="group relative overflow-hidden rounded-xl border border-[#1a2230] bg-[#0e1319] p-5 transition hover:-translate-y-0.5 hover:border-[rgba(244,211,94,0.35)]">
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-[10px] border text-[16px]" style={{ background: 'rgba(244,211,94,0.08)', borderColor: 'rgba(244,211,94,0.2)' }}>{f.icon}</div>
                <h3 className="mb-1.5 text-[15px] font-bold">{f.title}</h3>
                <p className="text-[12px] leading-relaxed text-[#848e9c]">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="xray" className="py-14" style={{ background: 'linear-gradient(180deg,transparent,rgba(244,211,94,0.03),transparent)' }}>
        <div className="mx-auto grid max-w-[1120px] items-center gap-10 px-[4%] md:grid-cols-2">
          <div className="overflow-hidden rounded-[14px] border border-[#1a2230] bg-[#0b0f14]" style={{ aspectRatio: '16/10' }}>
            <canvas ref={xrayRef} width={520} height={300} className="h-full w-full" />
          </div>
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F4D35E]">Order Block</div>
            <h3 className="mb-3 text-[22px] font-extrabold">X-Ray di mercato</h3>
            <p className="mb-4 text-[14px] leading-relaxed text-[#848e9c]">
              Sector strip lagging to leading, rank list e flow multi-linea. I PICK rispettano sector cap,
              liquidita minima e purezza del movimento (no chop).
            </p>
            <ul className="space-y-2 text-[13px] text-[#848e9c]">
              {['Body zone + break of structure', 'Mitigation: fresh / tested / mitigated / broken', 'Quality score e R:R basato su ATR', 'Board BULLISH / BEARISH / PICKS', 'Refresh periodico su universo Binance'].map((t) => (
                <li key={t} className="flex gap-2"><span className="font-bold text-[#0ecb81]">✓</span>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="how" className="py-16 border-t border-[#1a2230]">
        <div className="mx-auto max-w-[1120px] px-[4%]">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F4D35E]">Workflow</div>
          <h2 className="mb-10 text-[clamp(1.6rem,3vw,2.1rem)] font-extrabold">Come si usa</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border border-[#1a2230] bg-[#0e1319] p-5">
                <div className="mb-3 font-mono text-[20px] font-bold text-[#F4D35E]">{s.n}</div>
                <div className="mb-2 text-[15px] font-bold">{s.t}</div>
                <p className="text-[12px] leading-relaxed text-[#848e9c]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="data" className="py-16">
        <div className="mx-auto max-w-[1120px] px-[4%]">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F4D35E]">Dati & sicurezza</div>
          <h2 className="mb-3 text-[clamp(1.6rem,3vw,2.1rem)] font-extrabold">Solo feed reali</h2>
          <p className="mb-8 max-w-[520px] text-[14px] text-[#848e9c]">
            Architettura pensata per non inventare il mercato: se Binance o KuCoin non rispondono, il desk lo dice chiaramente.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DATA_POINTS.map((x) => (
              <div key={x.t} className="rounded-xl border border-[#1a2230] bg-[#0e1319] px-4 py-4">
                <div className="mb-1 text-[13px] font-bold text-[#eaecef]">{x.t}</div>
                <div className="text-[12px] text-[#848e9c] leading-snug">{x.d}</div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-[12px] leading-relaxed text-[#5e6673] max-w-[720px]">
            {brandName} is software for market visualization and optional self-directed trading via your
            exchange accounts. NACS Lab is not a broker, exchange, or investment advisor.
          </p>
        </div>
      </section>

      <section id="pricing" className="py-16 border-t border-[#1a2230]">
        <div className="mx-auto max-w-[1120px] px-[4%]">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F4D35E]">Pricing</div>
          <h2 className="mb-3 text-[clamp(1.6rem,3vw,2.1rem)] font-extrabold tracking-[-0.02em]">Piani e prezzi</h2>
          <p className="mb-10 max-w-[540px] text-[#848e9c] text-[14px]">
            Free per paper e lettura dati pubblici. Pro e Team sbloccano live trading, cloud workspace e quote AI.
            Checkout opzionale - contattaci per attivare Pro/Team.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {PLANS.map((p) => (
              <article
                key={p.id}
                className={
                  'relative flex flex-col rounded-xl border p-6 ' +
                  (p.highlight
                    ? 'border-[#F4D35E]/55 bg-[#12100a] shadow-[0_0_40px_rgba(244,211,94,0.12)]'
                    : 'border-[#1a2230] bg-[#0e1319]')
                }
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#F4D35E] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1a1a1a]">
                    Consigliato
                  </div>
                )}
                <div className="mb-1 text-[13px] font-semibold text-[#848e9c]">{p.name}</div>
                <div className="mb-1 flex items-baseline gap-1.5">
                  <span className="text-[32px] font-extrabold text-[#eaecef]">{p.price}</span>
                  <span className="text-[12px] text-[#5e6673]">/ {p.period}</span>
                </div>
                <p className="mb-5 text-[13px] leading-relaxed text-[#848e9c]">{p.blurb}</p>
                <ul className="mb-6 flex-1 space-y-2 text-[13px] text-[#c8cdd3]">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="font-bold text-[#0ecb81]">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={onRequestAccess}
                  className={
                    'w-full rounded-lg py-3 text-[14px] font-bold transition ' +
                    (p.highlight
                      ? 'text-[#1a1a1a]'
                      : 'border border-[#2a3140] bg-white/[0.03] text-[#eaecef] hover:border-[#F4D35E]/40')
                  }
                  style={p.highlight ? { background: 'linear-gradient(90deg,#F4D35E,#e0a800)' } : undefined}
                >
                  {p.cta}
                </button>
              </article>
            ))}
          </div>
          <p className="mt-6 text-center text-[12px] text-[#5e6673]">
            NACS Lab non e un broker. Trading live solo con le tue chiavi exchange (self-directed).
          </p>
        </div>
      </section>

      <section id="faq" className="py-16 border-t border-[#1a2230]">
        <div className="mx-auto max-w-[720px] px-[4%]">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F4D35E]">FAQ</div>
          <h2 className="mb-8 text-[clamp(1.6rem,3vw,2rem)] font-extrabold">Domande frequenti</h2>
          <div className="space-y-2">
            {FAQ.map((item, i) => {
              const open = openFaq === i
              return (
                <div key={item.q} className="rounded-xl border border-[#1a2230] bg-[#0e1319] overflow-hidden">
                  <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[14px] font-semibold" onClick={() => setOpenFaq(open ? null : i)}>
                    {item.q}
                    <span className="text-[#F4D35E] font-mono text-[16px]">{open ? '-' : '+'}</span>
                  </button>
                  {open && <div className="border-t border-[#1a2230] px-4 py-3 text-[13px] leading-relaxed text-[#848e9c]">{item.a}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-20">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(244,211,94,0.1), transparent 70%)' }} />
        <div className="relative mx-auto max-w-[680px] px-[4%] text-center">
          <div className="rounded-[20px] border px-8 py-12" style={{ background: '#0e1319', borderColor: 'rgba(244,211,94,0.3)', boxShadow: '0 0 60px rgba(244,211,94,0.15)' }}>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F4D35E]">Ready</div>
            <h2 className="mb-3 text-[24px] font-extrabold">Entra in {brandName}</h2>
            <p className="mb-7 text-[14px] text-[#848e9c]">Login per il desk completo, oppure guest in sola lettura su chart e dati pubblici.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={onRequestAccess} className="rounded-[10px] px-7 py-3.5 text-[15px] font-bold text-[#1a1a1a]" style={{ background: 'linear-gradient(90deg,#F4D35E,#e0a800)' }}>
                Accedi con credenziali
              </button>
              {onGuest && (
                <button type="button" onClick={onGuest} className="rounded-[10px] border border-[#2a3140] bg-white/[0.03] px-7 py-3.5 text-[15px] font-bold text-[#eaecef]">
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
            <span className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-black text-[#1a1a1a]" style={{ background: 'linear-gradient(135deg,#F4D35E,#e0a800)' }}>N</span>
            {brandName}
          </div>
          <div className="flex flex-wrap gap-5 text-[13px] text-[#5e6673]">
            <a href="#features" className="hover:text-[#848e9c]">Features</a>
            <a href="#how" className="hover:text-[#848e9c]">Come funziona</a>
            <a href="#data" className="hover:text-[#848e9c]">Dati</a>
            <a href="#pricing" className="hover:text-[#848e9c]">Prezzi</a>
            <a href="#faq" className="hover:text-[#848e9c]">FAQ</a>
          </div>
        </div>
        <p className="mt-6 text-center text-[11px] text-[#5e6673] max-w-[640px] mx-auto px-[4%] leading-relaxed">
          © {new Date().getFullYear()} NACS Lab · {brandName} · Non e un broker ne un advisor. Dati di mercato da exchange pubblici.
        </p>
      </footer>
    </div>
  )
}

export default LandingPage
