#!/usr/bin/env node
/**
 * Every WidgetKind must have:
 *  - an entry in WIDGET_META (layoutStore)
 *  - a case in PanelGrid renderWidget
 * Fails CI if a kind is added to types without wiring.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const types = readFileSync(join(ROOT, 'src/types/index.ts'), 'utf8')
const layout = readFileSync(join(ROOT, 'src/stores/layoutStore.ts'), 'utf8')
const grid = readFileSync(join(ROOT, 'src/layout/PanelGrid.tsx'), 'utf8')
const desk = readFileSync(join(ROOT, 'src/ui/DeskAddControls.tsx'), 'utf8')

const kindBlock = types.slice(
  types.indexOf('export type WidgetKind'),
  types.indexOf('export interface WidgetPanelConfig')
)
const kinds = [...kindBlock.matchAll(/\|\s*'([^']+)'/g)].map((m) => m[1])
if (kinds.length < 10) {
  console.error('assert-widget-coverage: failed to parse WidgetKind')
  process.exit(1)
}

const errors = []

for (const k of kinds) {
  const metaRe = new RegExp(`^\\s*${k}\\s*:\\s*\\{`, 'm')
  if (!metaRe.test(layout)) {
    errors.push(`WIDGET_META missing kind "${k}" in layoutStore.ts`)
  }

  const caseRe = new RegExp(`case\\s+'${k}'\\s*:`)
  if (!caseRe.test(grid)) {
    errors.push(`PanelGrid missing case '${k}'`)
  }
}

for (const k of ['cluster', 'tpo', 'footprint', 'battlefield']) {
  if (!desk.includes(`'${k}'`) && !desk.includes(`"${k}"`)) {
    errors.push(`DeskAddControls PRIORITY/labels missing '${k}'`)
  }
}

if (kinds.includes('tpo') || kinds.includes('cluster')) {
  const idx = readFileSync(join(ROOT, 'src/panels/instruments/index.ts'), 'utf8')
  if (kinds.includes('tpo') && !idx.includes('TpoChartPanel')) {
    errors.push('instruments/index.ts missing TpoChartPanel export')
  }
  if (kinds.includes('cluster') && !idx.includes('ClusterChartPanel')) {
    errors.push('instruments/index.ts missing ClusterChartPanel export')
  }
}

if (errors.length) {
  console.error('assert-widget-coverage FAILED:\n')
  for (const e of errors) console.error('  ·', e)
  process.exit(1)
}

console.log(`assert-widget-coverage OK (${kinds.length} WidgetKind wired)`)
