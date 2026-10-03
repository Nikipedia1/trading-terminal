import { useState } from 'react'
import { useMobileLayout } from '@/layout/useMobileLayout'
import { useLocale } from '@/i18n'

const DISMISS = 'tt-mobile-banner:v1'

export function MobileBanner() {
  const mobile = useMobileLayout()
  const { t } = useLocale()
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS) === '1'
    } catch {
      return false
    }
  })

  if (!mobile || hidden) return null

  return (
    <div
      className="shrink-0 z-50 border-b border-[#f0b90b]/40 bg-[#1a1508] px-3 py-2 flex items-start gap-2 text-[11px] text-[#eaecef]"
      role="status"
    >
      <span className="text-[#f0b90b] font-semibold">Desktop</span>
      <p className="flex-1 leading-snug text-[#848e9c]">{t('app.desktopRecommended')}</p>
      <button
        type="button"
        className="shrink-0 text-[#f0b90b] font-medium underline"
        onClick={() => {
          try {
            sessionStorage.setItem(DISMISS, '1')
          } catch {
            /* */
          }
          setHidden(true)
        }}
      >
        {t('app.continueMobile')}
      </button>
    </div>
  )
}
