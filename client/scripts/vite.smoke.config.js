/* Config used only by scripts/smoke.jsx: bundle dependencies for the SSR/node
   run so packages that ship extensionless ESM imports resolve the same way the
   browser build resolves them. */
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../src', import.meta.url)),
      '@db': fileURLToPath(new URL('../../database', import.meta.url)),
    },
  },
  ssr: { noExternal: true },
})
