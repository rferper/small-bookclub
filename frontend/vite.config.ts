import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Room for several findBy* waits (5 s each, see setup.ts) on a busy machine.
    testTimeout: 20000,
    // Half the cores, so a run leaves CPU for other work and stays reliable.
    maxWorkers: '50%',
  },
})
