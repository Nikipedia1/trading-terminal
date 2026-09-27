/**
 * Drawing primitives – ALWAYS stored in logical coordinates (time + price).
 * Never store pixel positions. Conversion happens only at render time
 * via CoordinateBridge (anti-pellicola).
 */

export type DrawingTool =
  | 'pan'
  | 'cursor'
  | 'trendline'
  | 'ray'
  | 'arrow'
  | 'horizontal'
  | 'vertical'
  | 'crossline'
  | 'rectangle'
  | 'triangle'
  | 'ellipse'
  | 'channel'
  | 'fib_retracement'
  | 'fib_extension'
  | 'measure'
  | 'long_position'
  | 'short_position'
  | 'polyline'
  | 'text'

export type LineStyleKind = 'solid' | 'dashed' | 'dotted'
export type LineEndKind = 'none' | 'arrow' | 'circle'

/** Logical point – unix seconds + price */
export interface LogicalPoint {
  time: number
  price: number
}

export interface DrawingStyle {
  color: string
  lineWidth: number
  /** solid | dashed | dotted */
  lineStyle?: LineStyleKind
  /** Legacy dash array – preferred: lineStyle */
  lineDash?: number[]
  /** Cap style at line ends */
  lineEnd?: LineEndKind
  fillOpacity?: number
  fontSize?: number
  /** Extend trendline/ray/horizontal past endpoints */
  extendLeft?: boolean
  extendRight?: boolean
}

const DEFAULT_STYLE: DrawingStyle = {
  color: '#1e90ff',
  lineWidth: 1.5,
  lineStyle: 'solid',
  lineEnd: 'none',
  fillOpacity: 0.12,
  fontSize: 12,
  extendLeft: false,
  extendRight: false,
}

/** Resolve lineDash from style */
export function styleToDash(style: DrawingStyle): number[] {
  if (style.lineDash && style.lineDash.length) return style.lineDash
  switch (style.lineStyle) {
    case 'dashed':
      return [8, 5]
    case 'dotted':
      return [2, 4]
    default:
      return []
  }
}

export interface DrawingBase {
  id: string
  tool: Exclude<DrawingTool, 'pan' | 'cursor'>
  style: DrawingStyle
  locked?: boolean
  createdAt: number
  updatedAt: number
}

export interface TrendlineDrawing extends DrawingBase {
  tool: 'trendline'
  p1: LogicalPoint
  p2: LogicalPoint
}

/** Ray: from p1 through p2, extends infinitely in p2 direction */
export interface RayDrawing extends DrawingBase {
  tool: 'ray'
  p1: LogicalPoint
  p2: LogicalPoint
}

/** Arrow: trendline with arrow head at p2 */
export interface ArrowDrawing extends DrawingBase {
  tool: 'arrow'
  p1: LogicalPoint
  p2: LogicalPoint
}

export interface HorizontalDrawing extends DrawingBase {
  tool: 'horizontal'
  price: number
}

export interface VerticalDrawing extends DrawingBase {
  tool: 'vertical'
  time: number
}

/** Crosshair-style H+V at one point */
export interface CrosslineDrawing extends DrawingBase {
  tool: 'crossline'
  point: LogicalPoint
}

export interface RectangleDrawing extends DrawingBase {
  tool: 'rectangle'
  p1: LogicalPoint
  p2: LogicalPoint
}

export interface TriangleDrawing extends DrawingBase {
  tool: 'triangle'
  p1: LogicalPoint
  p2: LogicalPoint
  p3: LogicalPoint
}

export interface EllipseDrawing extends DrawingBase {
  tool: 'ellipse'
  p1: LogicalPoint
  p2: LogicalPoint
}

/** Parallel channel: base line p1→p2, third point defines offset */
export interface ChannelDrawing extends DrawingBase {
  tool: 'channel'
  p1: LogicalPoint
  p2: LogicalPoint
  p3: LogicalPoint
}

export interface FibRetracementDrawing extends DrawingBase {
  tool: 'fib_retracement'
  p1: LogicalPoint
  p2: LogicalPoint
}

export interface FibExtensionDrawing extends DrawingBase {
  tool: 'fib_extension'
  p1: LogicalPoint
  p2: LogicalPoint
  p3: LogicalPoint
}

/** Measure tool: shows Δprice, Δ%, Δtime between two points */
export interface MeasureDrawing extends DrawingBase {
  tool: 'measure'
  p1: LogicalPoint
  p2: LogicalPoint
}

/** Long position box: entry (p1.price), stop (p2.price), target (p3.price); time span p1→p3 */
export interface LongPositionDrawing extends DrawingBase {
  tool: 'long_position'
  p1: LogicalPoint
  p2: LogicalPoint
  p3: LogicalPoint
}

export interface ShortPositionDrawing extends DrawingBase {
  tool: 'short_position'
  p1: LogicalPoint
  p2: LogicalPoint
  p3: LogicalPoint
}

/** Multi-point polyline (min 2 points) */
export interface PolylineDrawing extends DrawingBase {
  tool: 'polyline'
  points: LogicalPoint[]
}

export interface TextDrawing extends DrawingBase {
  tool: 'text'
  point: LogicalPoint
  text: string
}

export type Drawing =
  | TrendlineDrawing
  | RayDrawing
  | ArrowDrawing
  | HorizontalDrawing
  | VerticalDrawing
  | CrosslineDrawing
  | RectangleDrawing
  | TriangleDrawing
  | EllipseDrawing
  | ChannelDrawing
  | FibRetracementDrawing
  | FibExtensionDrawing
  | MeasureDrawing
  | LongPositionDrawing
  | ShortPositionDrawing
  | PolylineDrawing
  | TextDrawing

export const FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
export const FIB_EXTENSION_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2.618]

export function createDrawingId(): string {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function defaultStyle(overrides?: Partial<DrawingStyle>): DrawingStyle {
  return { ...DEFAULT_STYLE, ...overrides }
}

export function drawingsStorageKey(panelId: string, symbol: string): string {
  return `tt-drawings:v1:${panelId}:${symbol.toUpperCase()}`
}

export interface DrawingsExport {
  version: 1
  exportedAt: number
  panelId: string
  symbol: string
  drawings: Drawing[]
}
