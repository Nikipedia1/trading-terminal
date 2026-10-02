/**
 * Canvas layered stack – paint order / z-index contract.
 *
 *   L0 chart (lightweight-charts)     – bottom, in containerRef
 *   L1 static profile                 – volume profile bars + VAH/VAL/POC
 *   L2 footprint cells                – denser orderflow grid
 *   L3 live bubbles (deep trades)     – high-frequency paints
 *   L4 deep print / DOM overlays
 *   L4b cycles                        – bandpass wave + phase marks
 *   L5 drawings                       – interactive, topmost among data layers
 *   L6 chrome (HUD, errors)           – UI only
 *
 * Rule: static layers never repaint on every tick; live layers may.
 * Use LAYER_Z className on each absolute canvas.
 */

export const LAYER_Z = {
  profile: 'z-[4]',
  footprint: 'z-[5]',
  bubbles: 'z-[6]',
  deepPrint: 'z-[7]',
  cycles: 'z-[7]',
  drawings: 'z-[8]',
  paperLines: 'z-[9]',
  chrome: 'z-[10]',
} as const

export type LayerId = keyof typeof LAYER_Z
