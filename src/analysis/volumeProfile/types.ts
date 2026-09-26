/** Volume Profile (Deep Profile) types */

export type ProfileWindow =
  | 'visible'
  | 'session'
  | 'last_30m'
  | 'session_open_30m'
  | 'previous_day'

/** Fixed reference profiles (UTC – no official NY session on public crypto) */
export type FixedProfileKind = 'none' | 'session_open_30m' | 'previous_day'

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
  /** Realized VA share after accumulation */
  vaShare: number
  /** Target used for VA expansion (0.68 / 0.70 / 0.80) */
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
  /** Developing profile window (usually visible range) */
  developing: ProfileWindow
  /** Optional fixed overlay */
  fixed: FixedProfileKind
  /** Value Area target fraction */
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
}

export const FIXED_PROFILE_LABELS: Record<FixedProfileKind, string> = {
  none: 'None',
  session_open_30m: 'UTC open 30m',
  previous_day: 'Previous UTC day',
}

export const SESSION_NOTE =
  'Crypto spot has no official NY session. Presets use UTC midnight only.'
