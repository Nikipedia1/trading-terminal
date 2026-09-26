/** Volume Profile (Deep Profile) types */

export type ProfileWindow =
  | 'visible'
  | 'session'
  | 'last_30m'
  | 'session_open_30m'

export interface ProfileBucket {
  price: number
  volume: number
  buyVolume: number
  sellVolume: number
  /** Low volume node */
  isLvn?: boolean
}

export interface VolumeProfileModel {
  buckets: ProfileBucket[]
  totalVolume: number
  poc: number
  vah: number
  val: number
  vaShare: number
  tickSize: number
  window: ProfileWindow
  fromSec: number
  toSec: number
  tradeCount: number
  /** Prices marked as Low Volume Nodes */
  lvns: number[]
}

export const PROFILE_WINDOW_LABELS: Record<ProfileWindow, string> = {
  visible: 'Visible range',
  session: 'Session (UTC day)',
  last_30m: 'Last 30 min',
  session_open_30m: 'Session open 30m',
}
