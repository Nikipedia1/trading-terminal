import { useEffect, useState, useCallback } from 'react'
import { getLocale, setLocale, t, type Locale, type MessageKey } from './messages'

export function useLocale() {
  const [locale, setLoc] = useState<Locale>(() => getLocale())

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as Locale
      if (d === 'it' || d === 'en') setLoc(d)
    }
    window.addEventListener('tt-locale', on)
    return () => window.removeEventListener('tt-locale', on)
  }, [])

  const change = useCallback((l: Locale) => {
    setLocale(l)
    setLoc(l)
  }, [])

  const tr = useCallback((key: MessageKey) => t(key, locale), [locale])

  return { locale, setLocale: change, t: tr }
}
