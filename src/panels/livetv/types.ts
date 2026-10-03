/** Channel entry from public/config/live-tv-channels.json */
export interface LiveTvChannel {
  id: string
  name: string
  /** YouTube channel id → embed live_stream?channel= */
  channelId?: string
  /** Specific video / live video id → embed VIDEO_ID */
  videoId?: string
}

export interface LiveTvConfigFile {
  version?: number
  defaultChannelId?: string
  channels: LiveTvChannel[]
}
