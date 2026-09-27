/** Volume Profile – session windows (UTC honesty for crypto) */

export type ProfileWindow =
  | 'visible'
  | 'session'
  | 'last_30m'
  | 'session_open_30m'
  | 'previous_day'
  | 'weekly'
  | 'last_3d'

export type FixedProfileKind =
  | 'none'
  | 'session_open_30m'
  | 'previous_day'
  | 'weekly'

export interface ProfileBucket {
  price: number
  volume: number
  buyVolume: number
  sellVolume: number
  isLvn?: boolean
  isHvn?: boolean
}

export interface VolumeProfileModel {
  buckets: ProfileBucket[]
  totalVolume: number
  poc: number
  vah: number
  val: number
  vaShare: number
  vaTarget: number
  tickSize: number
  window: ProfileWindow
  fromSec: number
  toSec: number
  tradeCount: number
  lvns: number[]
  hvns: number[]
}

export interface ProfileConfig {
  developing: ProfileWindow
  fixed: FixedProfileKind
  vaTarget: 0.68 | 0.7 | 0.8
}

export const DEFAULT_PROFILE_CONFIG: ProfileConfig = {
  developing: 'visible',
  fixed: 'none',
  vaTarget: 0.7,
}

export const PROFILE_WINDOW_LABELS: Record<ProfileWindow, string> = {
  visible: 'Visible range',
  session: 'UTC day (00:00)',
  last_30m: 'Last 30 min',
  session_open_30m: 'UTC open 30m',
  previous_day: 'Previous UTC day',
  weekly: 'UTC week (Mon 00:00)',
  last_3d: 'Last 3 UTC days',
}

export const FIXED_PROFILE_LABELS: Record<FixedProfileKind, string> = {
  none: 'None',
  session_open_30m: 'UTC open 30m',
  previous_day: 'Previous UTC day',
  weekly: 'UTC week',
}

export const SESSION_NOTE =
  'Crypto has no official RTH/ETH. Presets use UTC midnight / Monday only — not NY session.'
