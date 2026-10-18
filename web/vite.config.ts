import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The built UI fetches /history same-origin (nginx proxies it to the agent). Give the dev server
  // the same shape so the history views work without a build.
  server: {
    proxy: {
      '/history': 'http://localhost:8787',
    },
  },
})
