/**
 * PanelGrid – magnetic grid layout for chart panels.
 * Uses react-grid-layout (already in package.json).
 * Drag via header handle; resize via borders/corners.
 */

import { useMemo, useCallback } from 'react'
import GridLayout, { type Layout } from 'react-grid-layout'
import { useLayoutStore } from '@/stores/layoutStore'
import { ChartPanel } from '@/charts/ChartPanel'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const COLS = 12
const ROW_HEIGHT = 28

interface PanelGridProps {
  width: number
  height: number
}

export function PanelGrid({ width }: PanelGridProps) {
  const panels = useLayoutStore((s) => s.panels)
  const layout = useLayoutStore((s) => s.layout)
  const setLayout = useLayoutStore((s) => s.setLayout)
  const addPanel = useLayoutStore((s) => s.addPanel)

  const onLayoutChange = useCallback(
    (next: Layout[]) => {
      setLayout(
        next.map((l) => ({
          i: l.i,
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
          minW: l.minW ?? 4,
          minH: l.minH ?? 4,
        }))
      )
    },
    [setLayout]
  )

  const panelMap = useMemo(() => {
    const m = new Map(panels.map((p) => [p.id, p]))
    return m
  }, [panels])

  if (width <= 0) return null

  return (
    <div className="relative h-full w-full overflow-auto">
      <div className="absolute top-1 right-2 z-20 flex gap-1">
        <button
          onClick={addPanel}
          className="px-2 py-0.5 text-xs bg-terminal-green/20 text-terminal-green border border-terminal-green/40 rounded hover:bg-terminal-green/30"
          title="Add chart panel"
        >
          +
        </button>
      </div>

      <GridLayout
        className="layout"
        layout={layout}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        width={width}
        onLayoutChange={onLayoutChange}
        draggableHandle=".panel-drag-handle"
        compactType="vertical"
        preventCollision={false}
        margin={[4, 4]}
        containerPadding={[4, 4]}
        resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n']}
      >
        {layout.map((item) => {
          const config = panelMap.get(item.i)
          if (!config) return <div key={item.i} />
          return (
            // h-full is required: RGL sets pixel height on .react-grid-item;
            // without it, ChartPanel h-full collapses and chrome gets clipped
            <div key={item.i} className="h-full overflow-hidden">
              <ChartPanel config={config} />
            </div>
          )
        })}
      </GridLayout>
    </div>
  )
}
