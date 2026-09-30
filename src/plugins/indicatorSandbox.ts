export interface PluginSeriesInput {
  open: number[]
  high: number[]
  low: number[]
  close: number[]
  volume: number[]
}

export interface PluginResult {
  values: (number | null)[]
  error?: string
}

const MAX_CODE = 8_000
const MAX_BARS = 5_000

export function runIndicatorPlugin(
  code: string,
  input: PluginSeriesInput
): PluginResult {
  if (!code || code.length > MAX_CODE) {
    return { values: [], error: 'code empty or too long' }
  }
  const n = Math.min(input.close.length, MAX_BARS)
  const o = input.open.slice(-n)
  const h = input.high.slice(-n)
  const l = input.low.slice(-n)
  const c = input.close.slice(-n)
  const v = input.volume.slice(-n)

  const banned =
    /\b(window|document|fetch|XMLHttp|localStorage|sessionStorage|import|eval|Function|Worker|process|globalThis|require)\b/i
  if (banned.test(code)) {
    return { values: [], error: 'forbidden identifier in plugin code' }
  }

  try {
    const fn = new Function(
      'open',
      'high',
      'low',
      'close',
      'volume',
      `"use strict";\n${code}\n;if (typeof indicator === "function") return indicator(open,high,low,close,volume);\nthrow new Error("define function indicator(o,h,l,c,v)");`
    ) as (
      o: number[],
      h: number[],
      l: number[],
      c: number[],
      v: number[]
    ) => unknown

    const out = fn(o, h, l, c, v)
    if (!Array.isArray(out)) {
      return { values: [], error: 'indicator must return an array' }
    }
    const values = out.slice(0, n).map((x) => {
      const num = typeof x === 'number' ? x : Number(x)
      return Number.isFinite(num) ? num : null
    })
    return { values }
  } catch (e) {
    return {
      values: [],
      error: e instanceof Error ? e.message : 'plugin error',
    }
  }
}
