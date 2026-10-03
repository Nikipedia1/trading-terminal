/**
 * Commercial plans – entitlement matrix.
 * Billing provider (Stripe etc.) is optional; plan can be set by admin/env until checkout is wired.
 */

export type PlanId = 'free' | 'pro' | 'team'

export interface PlanDefinition {
  id: PlanId
  name: string
  priceLabel: string
  blurb: string
  features: string[]
  entitlements: {
    paperTrading: boolean
    liveTrading: boolean
    aiAnalyzePerHour: number
    cloudWorkspace: boolean
    teamSeats: number
    prioritySupport: boolean
    opsPanel: boolean
  }
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    priceLabel: '€0',
    blurb: 'Paper desk, public market data, Learn & News.',
    features: [
      'Paper trading only',
      'Charts + order book + news',
      'Learn academy',
      'AI analyze (limited quota)',
      'Local workspace export',
    ],
    entitlements: {
      paperTrading: true,
      liveTrading: false,
      aiAnalyzePerHour: 5,
      cloudWorkspace: false,
      teamSeats: 1,
      prioritySupport: false,
      opsPanel: true,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceLabel: 'Contact',
    blurb: 'Live keys, higher AI quota, cloud workspace.',
    features: [
      'Everything in Free',
      'Live trading UI + risk gates',
      'Encrypted API keys (browser vault)',
      'Cloud workspace (KV)',
      'Higher AI quota',
    ],
    entitlements: {
      paperTrading: true,
      liveTrading: true,
      aiAnalyzePerHour: 30,
      cloudWorkspace: true,
      teamSeats: 1,
      prioritySupport: true,
      opsPanel: true,
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    priceLabel: 'Contact',
    blurb: 'Shared desks, roles, priority support.',
    features: [
      'Everything in Pro',
      'Multiple seats (RBAC)',
      'Shared layout templates',
      'Priority support SLA target',
      'Ops & audit visibility',
    ],
    entitlements: {
      paperTrading: true,
      liveTrading: true,
      aiAnalyzePerHour: 60,
      cloudWorkspace: true,
      teamSeats: 10,
      prioritySupport: true,
      opsPanel: true,
    },
  },
}

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'team']
