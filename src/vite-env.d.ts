/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKSPACE_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
