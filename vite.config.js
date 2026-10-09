import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import apiApp from './server/app.js'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'weathergpt-local-api',
      configureServer(server) {
        server.middlewares.use(apiApp)
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
})
