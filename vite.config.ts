import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Modo celular: el teléfono solo conoce la dirección de este computador; /api se pasa a la API local
const API_LOCAL = { '/api': 'http://127.0.0.1:8080' }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true, proxy: API_LOCAL },
  // App instalable en el celular (npm run celular:app): build de producción servido aquí y abierto por un túnel HTTPS
  preview: { port: 4173, strictPort: true, proxy: API_LOCAL, allowedHosts: ['.trycloudflare.com'] },
})
