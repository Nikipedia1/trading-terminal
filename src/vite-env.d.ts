/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INDICATOR_PLUGINS?: string
  readonly VITE_LIVE_KEYS_UI?: string
  readonly VITE_AUTO_CLOUD_LAYOUT?: string
  readonly VITE_ALLOW_GUEST?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_WORKSPACE_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
