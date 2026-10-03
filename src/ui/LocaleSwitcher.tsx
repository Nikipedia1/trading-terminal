import { useLocale, type Locale } from '@/i18n'

export function LocaleSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  return (
    <select
      aria-label="Language"
      className={`bg-[#0b0e11] border border-[#2b3139] rounded text-[10px] text-[#848e9c] px-1.5 py-1 ${className}`}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
    >
      <option value="en">EN</option>
      <option value="it">IT</option>
    </select>
  )
}
