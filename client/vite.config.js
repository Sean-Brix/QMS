import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  /* GitHub Pages serves a project site from https://<user>.github.io/<repo>/,
     so every asset URL needs that prefix. The deploy workflow sets VITE_BASE
     from the repository name; a local `npm run dev` leaves it at the root. */
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Application source
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Temporary JSON "database" living at the project root, one file per table
      '@db': fileURLToPath(new URL('../database', import.meta.url)),
    },
  },
  server: {
    // Allow serving the ../database folder, which sits outside the Vite root
    fs: { allow: ['..'] },
  },
})
