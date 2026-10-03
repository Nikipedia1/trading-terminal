import { PLAN_ORDER, PLANS } from './plans'
import { usePlanStore } from './planStore'
import { BRAND } from '@/brand'

/**
 * Plan picker – commercial matrix. Checkout is external / contact until Stripe is configured.
 */
export function PlansPanel() {
  const planId = usePlanStore((s) => s.planId)
  const setPlan = usePlanStore((s) => s.setPlan)
  const checkout = (import.meta as { env?: Record<string, string> }).env?.VITE_STRIPE_CHECKOUT_URL

  return (
    <div className="h-full overflow-y-auto p-3 text-[11px] text-[#eaecef] bg-[#0b0e11]">
      <h2 className="text-sm font-semibold text-[#f0b90b] mb-1">Plans</h2>
      <p className="text-[#848e9c] mb-3 leading-relaxed">
        Free = paper desk. Pro / Team unlock live execution paths when you attach exchange keys.
        Payment provider optional — use Contact or configure <code className="text-[#f0b90b]">VITE_STRIPE_CHECKOUT_URL</code>.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id]
          const active = planId === id
          return (
            <div
              key={id}
              className={
                'rounded-lg border p-3 flex flex-col gap-2 ' +
                (active ? 'border-[#f0b90b] bg-[#1a1508]' : 'border-[#2b3139] bg-[#0d1117]')
              }
            >
              <div className="flex justify-between items-baseline">
                <span className="font-semibold">{p.name}</span>
                <span className="text-[#f0b90b]">{p.priceLabel}</span>
              </div>
              <p className="text-[#848e9c] text-[10px] leading-snug">{p.blurb}</p>
              <ul className="text-[10px] text-[#c8cdd3] space-y-0.5 flex-1">
                {p.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              <button
                type="button"
                className={
                  'w-full py-1.5 rounded text-[11px] font-semibold ' +
                  (active
                    ? 'bg-[#0ecb81]/20 text-[#0ecb81]'
                    : 'bg-[#f0b90b] text-[#0b0e11] hover:bg-[#fcd535]')
                }
                onClick={() => setPlan(id)}
              >
                {active ? 'Current plan' : `Use ${p.name}`}
              </button>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
        {checkout ? (
          <a
            href={checkout}
            target="_blank"
            rel="noreferrer"
            className="px-2 py-1 rounded border border-[#f0b90b]/50 text-[#f0b90b]"
          >
            Checkout
          </a>
        ) : (
          <a
            href={`mailto:${BRAND.supportEmail}?subject=NACS%20Lab%20Pro%2FTeam`}
            className="px-2 py-1 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]"
          >
            Contact sales
          </a>
        )}
        <a href={BRAND.pricingUrl} className="px-2 py-1 rounded border border-[#2b3139] text-[#848e9c]">
          Full pricing page
        </a>
        <a href={BRAND.roadmapUrl} className="px-2 py-1 rounded border border-[#2b3139] text-[#848e9c]">
          Roadmap
        </a>
      </div>
      <p className="mt-3 text-[9px] text-[#5e6673] leading-relaxed">{BRAND.legalNote}</p>
    </div>
  )
}
