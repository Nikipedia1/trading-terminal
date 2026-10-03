import { registerPanelType } from '../registry'
import { CalendarPanel } from './CalendarPanel'

registerPanelType({
  kind: 'calendar',
  title: 'Calendario',
  minW: 3,
  minH: 6,
  defaultW: 4,
  defaultH: 12,
  component: CalendarPanel,
})

export { CalendarPanel } from './CalendarPanel'
export type { MacroCalendarEvent, MacroImpact, CalendarApiResponse } from './types'
