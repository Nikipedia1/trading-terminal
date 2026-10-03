/**
 * ChartContainer – price chart on top; oscillator panes stacked below.
 */

import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  ColorType,
  CrosshairMode,
  PriceScaleMode,
} from 'lightweight-charts'
import type { Candle, ConnectionStatus, MarketError, ExchangeId, Interval } from '@/types'
import { SeriesManager } from './series-manager'
import { IndicatorSeriesManager } from './indicator-series'
import { IndicatorPanes } from './IndicatorPanes'
import { IndicatorValuesHud } from './IndicatorValuesHud'
import { CoordinateBridge } from './coordinate-bridge'
import { attachFreePan, unlockPriceScale } from './free-pan'
import {
  publishSync,
  subscribeSyncGroup,
  setSyncHighlight,
  type SyncPayload,
} from '@/stores/layoutStore'
import { useChartStyleStore } from '@/stores/chartStyleStore'
import { useChartFocusStore } from '@/stores/chartFocusStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useDrawingStore } from '@/drawings/drawingStore'
import { DrawingLayer } from '@/drawings/DrawingLayer'
import { ChartStylePanel } from './ChartStylePanel'
import { LivePriceBadge } from './LivePriceBadge'
import { NativeLwcLines } from './NativeLwcLines'
import { PaperEquitySeries } from './PaperEquitySeries'
import {
  GammaOverlay,
  DEFAULT_GAMMA_CONFIG,
  type GammaConfig,
} from '@/analysis/gamma'
import { DeepPrintOverlay } from '@/analysis/deepPrint'
import { CycleOverlay, DEFAULT_CYCLE_CONFIG, type CycleConfig } from '@/analysis/cycles'
import {
  useCandleDeltaSeries,
  type DeltaPrintConfig,
  DEFAULT_DELTA_CONFIG,
} from '@/analysis/deltaPrint'
import {
  VolumeProfileOverlay,
  RangeDiscoveryBadge,
  type ProfileConfig,
  DEFAULT_PROFILE_CONFIG,
} from '@/analysis/volumeProfile'
import {
  DeepTradesOverlay,
  type DeepTradesConfig,
  DEFAULT_DEEP_TRADES_CONFIG,
} from '@/analysis/deepTrades'
import {
  DeepDomOverlay,
  DomLadder,
  type DeepDomConfig,
  DEFAULT_DEEP_DOM_CONFIG,
} from '@/analysis/deepDom'
import {
  FootprintOverlay,
  type FootprintConfig,
  DEFAULT_FOOTPRINT_CONFIG,
} from '@/analysis/footprint'
import { ReplayBar } from '@/analysis/replay'
import { PaperPositionLines } from '@/trading/paper'
import { LOAD_MORE_THRESHOLD } from '@/data/klines/history'

function intervalToSeconds(interval: Interval): number {
  const m: Record<string, number> = {
    '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
    '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '8h': 28800,
    '12h': 43200, '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000,
  }
  return m[interval] ?? 60
}

export function ChartContainer() {
  return null
}
