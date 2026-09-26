/** Volume Profile (Deep Profile) types */

export type ProfileWindow =
  | 'visible'
  | 'session'
  | 'last_30m'
  | 'session_open_30m'

export interface ProfileBucket {
  /** Mid / key price of bucket */
  price: number
  volume: number
  buyVolume: number
  sellVolume: number
}

export interface VolumeProfileModel {
  buckets: ProfileBucket[]
  totalVolume: number
  /** Price of max volume bucket */
  poc: number
  /** Value Area High */
  vah: number
  /** Value Area Low */
  val: number
  /** Fraction of volume inside VA (target ~0.7) */
  vaShare: number
  tickSize: number
  window: ProfileWindow
  /** Unix seconds range used */
  fromSec: number
  toSec: number
  tradeCount: number
}

export const PROFILE_WINDOW_LABELS: Record<ProfileWindow, string> = {
  visible: 'Visible range',
  session: 'Session (UTC day)',
  last_30m: 'Last 30 min',
  session_open_30m: 'Session open 30m',
}
