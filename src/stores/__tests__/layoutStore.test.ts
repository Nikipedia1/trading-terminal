import { describe, it, expect, beforeEach } from 'vitest'
import { useLayoutStore } from '../layoutStore'

describe('layoutStore', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      panels: [{ id: 'panel-main', symbol: 'BTCUSDT', interval: '1m', exchange: 'binance', syncGroup: null }],
      widgets: [],
      layout: [{ i: 'panel-main', x: 0, y: 0, w: 12, h: 18, minW: 4, minH: 4 }],
      primaryPanelId: 'panel-main',
    })
  })

  it('starts with main chart only', () => {
    expect(useLayoutStore.getState().panels).toHaveLength(1)
  })

  it('addWidget attaches layout slot', () => {
    useLayoutStore.getState().addWidget('wallet')
    const s = useLayoutStore.getState()
    const id = s.widgets.find((w) => w.kind === 'wallet')!.id
    expect(s.layout.some((l) => l.i === id)).toBe(true)
  })

  it('cannot remove last chart panel', () => {
    useLayoutStore.getState().removePanel('panel-main')
    expect(useLayoutStore.getState().panels).toHaveLength(1)
  })
})
