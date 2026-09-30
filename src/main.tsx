import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/stores/layoutPersist'
import { initTelemetry } from '@/lib/telemetry'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import App from './App'
import './index.css'

initTelemetry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary name="root">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
