import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    env: {
      VITE_SUPABASE_URL: 'https://auth-unit.invalid',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    },
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
