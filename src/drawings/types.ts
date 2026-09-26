/**
 * Drawing primitives – ALWAYS stored in logical coordinates (time + price).
 * Never store pixel positions. Conversion happens only at render time
 * via CoordinateBridge (anti-pellicola).
 */

export type DrawingTool =
  | 'cursor'
  | 'trendline'
  | 'horizontal'
  | 'vertical'
  | 'rectangle'
  | 'channel'
  | 'fib_retracement'
  | 'fib_extension'
  | 'text'

/** Logical point – unix seconds + price */
export interface LogicalPoint {
  time: number
  price: number
}

export interface DrawingStyle {
  color: string
  lineWidth: number
  lineDash?: number[]
  fillOpacity?: number
  fontSize?: number
}

const DEFAULT_STYLE: DrawingStyle = {
  color: '#1e90ff',
  lineWidth: 1.5,
  fillOpacity: 0.12,
  fontSize: 12,
}

export interface DrawingBase {
  id: string
  tool: Exclude<DrawingTool, 'cursor'>
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

export interface HorizontalDrawing extends DrawingBase {
  tool: 'horizontal'
  price: number
}

export interface VerticalDrawing extends DrawingBase {
  tool: 'vertical'
  time: number
}

export interface RectangleDrawing extends DrawingBase {
  tool: 'rectangle'
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
  p1: LogicalPoint // start (usually swing high/low)
  p2: LogicalPoint // end
}

export interface FibExtensionDrawing extends DrawingBase {
  tool: 'fib_extension'
  p1: LogicalPoint
  p2: LogicalPoint
  p3: LogicalPoint
}

export interface TextDrawing extends DrawingBase {
  tool: 'text'
  point: LogicalPoint
  text: string
}

export type Drawing =
  | TrendlineDrawing
  | HorizontalDrawing
  | VerticalDrawing
  | RectangleDrawing
  | ChannelDrawing
  | FibRetracementDrawing
  | FibExtensionDrawing
  | TextDrawing

export const FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
export const FIB_EXTENSION_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2.618]

export function createDrawingId(): string {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function defaultStyle(overrides?: Partial<DrawingStyle>): DrawingStyle {
  return { ...DEFAULT_STYLE, ...overrides }
}

/** Storage key: drawings for a given panel + symbol */
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
