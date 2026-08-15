import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@tarojs/components': fileURLToPath(
        new URL('./src/test/mocks/components.tsx', import.meta.url),
      ),
      '@tarojs/taro': fileURLToPath(
        new URL('./src/test/mocks/taro.ts', import.meta.url),
      ),
      '@homework/api-types': fileURLToPath(
        new URL('../../packages/api-types/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
