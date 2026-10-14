import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Optional: point local Vite at a deployed Pages origin so /api/* works without wrangler.
  // Example: VITE_API_PROXY=https://your-project.pages.dev
  const apiProxy = env.VITE_API_PROXY || env.VITE_PAGES_ORIGIN || ''
  // Electron loads dist via file:// — relative asset paths are required.
  const isDesktop = mode === 'desktop'

  return {
    base: isDesktop ? './' : '/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: apiProxy
        ? {
            '/api': {
              target: apiProxy,
              changeOrigin: true,
              secure: true,
            },
          }
        : undefined,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      globals: false,
    },
  }
})
