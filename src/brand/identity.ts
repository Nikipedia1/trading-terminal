/** Product identity – NACS Lab Terminal */

export const BRAND = {
  name: 'NACS Lab Terminal',
  shortName: 'NACS Lab',
  tagline: 'Blockchain Trading Terminal',
  versionLabel: 'v0.2',
  /**
   * Assets in public/brand/ (uploaded filenames).
   * 1791116462822.jpg = full logo (mark + wordmark)
   * 1791116456775.jpg = splash / loading hero
   */
  logoMarkUrl: '/brand/1791116462822.jpg',
  logoFullUrl: '/brand/1791116462822.jpg',
  logoWordmarkUrl: '/brand/1791116462822.jpg',
  splashHeroUrl: '/brand/1791116456775.jpg',
  logoMarkSvgUrl: '/brand/logo-mark.svg',
  faviconUrl: '/favicon.svg',
  legalEntity: 'NACS Lab',
  legalNote:
    'NACS Lab Terminal is software for market visualization and optional self-directed trading via your exchange accounts. NACS Lab is not a broker, exchange, or investment advisor.',
  supportEmail: 'support@nacslab.example',
  statusUrl: '/status/',
  roadmapUrl: '/roadmap/',
  pricingUrl: '/pricing/',
  supportUrl: '/support/',
} as const
