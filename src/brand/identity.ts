/** Product identity – NACS Lab Terminal */

export const BRAND = {
  name: 'NACS Lab Terminal',
  shortName: 'NACS Lab',
  tagline: 'Blockchain Trading Terminal',
  versionLabel: 'v0.2',
  /** Square mark for header / favicon-adjacent UI */
  logoMarkUrl: '/brand/nacs-mark.jpg',
  /** Full horizontal logo (mark + wordmark) for splash / login */
  logoFullUrl: '/brand/nacs-logo-full.jpg',
  logoWordmarkUrl: '/brand/nacs-wordmark.jpg',
  /** Loading / guest splash hero art */
  splashHeroUrl: '/brand/splash-hero.jpg',
  /** Legacy SVG (fallback) */
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
