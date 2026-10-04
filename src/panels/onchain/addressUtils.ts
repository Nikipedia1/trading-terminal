import type { AddressChain } from './types'

export function detectAddressChain(
  address: string
): Exclude<AddressChain, 'auto'> | null {
  const a = address.trim()
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return 'eth'
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a)) return 'btc'
  if (/^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a)) return 'ltc'
  if (
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) &&
    !a.startsWith('bc1') &&
    !a.startsWith('ltc1')
  )
    return 'sol'
  return null
}

export function validateAddressFormat(
  chain: Exclude<AddressChain, 'auto'>,
  address: string
): string | null {
  const a = address.trim()
  if (chain === 'eth' && !/^0x[a-fA-F0-9]{40}$/.test(a))
    return 'Formato ETH non valido (0x + 40 hex)'
  if (chain === 'btc' && !/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a))
    return 'Formato Bitcoin non valido'
  if (chain === 'ltc' && !/^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a))
    return 'Formato Litecoin non valido'
  if (chain === 'sol' && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a))
    return 'Formato Solana non valido (base58)'
  return null
}
