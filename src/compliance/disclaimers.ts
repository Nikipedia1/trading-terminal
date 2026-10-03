/** Legal / compliance copy – not financial advice. */

export const DISCLAIMER_SHORT =
  'Informazione generica, non consiglio finanziario né sollecitazione al pubblico risparmio.'

export const DISCLAIMER_AI =
  'Interpretazione AI automatica: non è consulenza in materia di investimenti. Verifica sempre fonti primarie.'

export const DISCLAIMER_LIVE =
  'Il trading live comporta rischio di perdita del capitale. Usa API key senza prelievo. Paper e live sono separati.'

export const MIFID_NOTE =
  'NACS Lab Terminal non è un intermediario autorizzato MiFID II / non fornisce consulenza personalizzata. ' +
  'L’utente è responsabile di conformità locale e record keeping delle proprie operazioni.'

export const PRIVACY_SUMMARY =
  'Dati account su Cloudflare KV (hash password). Sessioni in cookie HttpOnly. ' +
  'API key exchange solo cifrati localmente (AES-GCM) e in memoria di sessione – non inviati ai nostri server.'

export const LEGAL_LINKS = {
  privacy: '/legal/privacy.html',
  terms: '/legal/terms.html',
  risk: '/legal/risk.html',
} as const
