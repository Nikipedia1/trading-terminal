/** AI impact card – disclaimer always visible · no buy/sell · glossary links. */

import type { NewsImpactAnalysis } from './types'
import { GlossaryLinkedText, GlossaryHitChips } from '@/panels/learn/GlossaryLinkedText'

const DIR_STYLE: Record<
  NewsImpactAnalysis['direzione'],
  { label: string; className: string }
> = {
  rialzista: {
    label: 'Rialzista',
    className: 'text-terminal-green border-terminal-green/40 bg-terminal-green/10',
  },
  ribassista: {
    label: 'Ribassista',
    className: 'text-terminal-red border-terminal-red/40 bg-terminal-red/10',
  },
  neutra: {
    label: 'Neutra',
    className: 'text-[#848e9c] border-[#2b3139] bg-[#1e2329]',
  },
}

const DEFAULT_DISCLAIMER =
  'Interpretazione AI, non consiglio finanziario. Nessun invito a comprare o vendere.'

export function ImpactCard({
  analysis,
  onClose,
}: {
  analysis: NewsImpactAnalysis
  onClose?: () => void
}) {
  const dir = DIR_STYLE[analysis.direzione] ?? DIR_STYLE.neutra
  const confPct = Math.round((analysis.confidenza ?? 0) * 100)
  const disclaimer = analysis.disclaimer || DEFAULT_DISCLAIMER

  return (
    <div className="mt-2 rounded border border-[#2b3139] bg-[#0d1117] p-2 space-y-1.5 text-[10px] leading-snug">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[9px] uppercase tracking-wide text-[#f0b90b]/90 font-semibold">
          {disclaimer}
        </span>
        {onClose && (
          <button
            type="button"
            className="text-[#848e9c] hover:text-[#eaecef] text-[10px] shrink-0"
            onClick={onClose}
            title="Chiudi"
          >
            ✕
          </button>
        )}
      </div>

      {(analysis.meta?.fallback || analysis.meta?.cached) && (
        <div className="flex flex-wrap gap-1 text-[9px] text-[#848e9c]">
          {analysis.meta.fallback && (
            <span className="px-1 rounded border border-[#f0b90b]/40 text-[#f0b90b]">
              Fallback (modello non disponibile)
            </span>
          )}
          {analysis.meta.cached && (
            <span className="px-1 rounded border border-[#2b3139]">Cache</span>
          )}
          {analysis.meta.provider && (
            <span className="px-1 rounded border border-[#2b3139]">{analysis.meta.provider}</span>
          )}
        </div>
      )}

      <p className="text-[#eaecef]">
        <GlossaryLinkedText text={analysis.sintesi} />
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`px-1.5 py-0.5 rounded border ${dir.className}`}>{dir.label}</span>
        <span className="px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c]">
          Forza {analysis.forza}/5
        </span>
        <span className="px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c]">
          {analysis.orizzonte}
        </span>
        <span className="px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c]">
          Conf. {confPct}%
        </span>
      </div>

      {analysis.asset_coinvolti?.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {analysis.asset_coinvolti.map((a) => (
            <span
              key={a}
              className="px-1 rounded bg-[#1e2329] text-[#f0b90b] border border-[#f0b90b]/30"
            >
              {a}
            </span>
          ))}
        </div>
      )}

      <div>
        <div className="text-[#848e9c] text-[9px] uppercase tracking-wide">Meccanismo</div>
        <p className="text-[#c8cdd3]">
          <GlossaryLinkedText text={analysis.meccanismo} />
        </p>
      </div>

      {analysis.rischi?.length > 0 && (
        <div>
          <div className="text-[#848e9c] text-[9px] uppercase tracking-wide">Rischi</div>
          <ul className="list-disc list-inside text-[#c8cdd3] space-y-0.5">
            {analysis.rischi.map((r, i) => (
              <li key={i}>
                <GlossaryLinkedText text={r} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="text-[#848e9c] text-[9px] uppercase tracking-wide">
          Livelli da osservare
        </div>
        <p className="text-[#c8cdd3]">
          <GlossaryLinkedText text={analysis.livelli_da_osservare} />
        </p>
      </div>

      {analysis.fonti && analysis.fonti.length > 0 && (
        <div>
          <div className="text-[#848e9c] text-[9px] uppercase tracking-wide">Fonti</div>
          <p className="text-[#848e9c]">{analysis.fonti.join(' · ')}</p>
        </div>
      )}

      <GlossaryHitChips
        texts={[
          analysis.sintesi,
          analysis.meccanismo,
          analysis.livelli_da_osservare,
          ...(analysis.rischi ?? []),
        ]}
      />

      <p className="text-[9px] text-[#5e6673] border-t border-[#1e2329] pt-1.5">
        Non è un invito a comprare o vendere. Verifica sempre fonti primarie e il tuo piano di
        rischio.
      </p>
    </div>
  )
}
