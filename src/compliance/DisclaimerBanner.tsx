import { DISCLAIMER_SHORT, LEGAL_LINKS, MIFID_NOTE } from './disclaimers'

export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-[9px] text-[#5e6673] leading-snug text-center">
        {DISCLAIMER_SHORT}{' '}
        <a className="text-[#848e9c] underline" href={LEGAL_LINKS.terms} target="_blank" rel="noreferrer">
          Terms
        </a>
        {' · '}
        <a className="text-[#848e9c] underline" href={LEGAL_LINKS.privacy} target="_blank" rel="noreferrer">
          Privacy
        </a>
      </p>
    )
  }
  return (
    <div className="rounded-lg border border-[#2b3139] bg-[#0b0e11]/80 px-3 py-2 text-[10px] text-[#848e9c] leading-relaxed space-y-1">
      <p>{DISCLAIMER_SHORT}</p>
      <p className="text-[#5e6673]">{MIFID_NOTE}</p>
      <p className="flex flex-wrap gap-2">
        <a className="underline hover:text-[#eaecef]" href={LEGAL_LINKS.terms} target="_blank" rel="noreferrer">
          Terms of Use
        </a>
        <a className="underline hover:text-[#eaecef]" href={LEGAL_LINKS.privacy} target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
        <a className="underline hover:text-[#eaecef]" href={LEGAL_LINKS.risk} target="_blank" rel="noreferrer">
          Risk Disclosure
        </a>
      </p>
    </div>
  )
}
