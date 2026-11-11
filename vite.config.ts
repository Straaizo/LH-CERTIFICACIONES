import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Modo celular: el teléfono solo conoce la dirección de este computador; /api se pasa a la API local
const API_LOCAL = { '/api': 'http://127.0.0.1:8080' }

// Versión de cada build: la app la compara con /version.json para avisar que hay una nueva
const VERSION = new Date().toISOString()

/** En Windows un servidor local puede tener el archivo abierto un instante: se reintenta antes de fallar. */
function escribir(ruta: string, contenido: string): void {
  for (let intento = 0; ; intento++) {
    try {
      writeFileSync(ruta, contenido)
      return
    } catch (e) {
      if (intento >= 20) throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
    }
  }
}

/** Escribe dist/version.json y pone la versión en dist/sw.js (así el navegador detecta el service worker nuevo). */
function versionApp(): Plugin {
  let salida = 'dist'
  return {
    name: 'version-app',
    apply: 'build',
    configResolved(config) {
      salida = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      escribir(resolve(salida, 'version.json'), JSON.stringify({ version: VERSION }))
      const sw = resolve(salida, 'sw.js')
      escribir(sw, readFileSync(sw, 'utf-8').replaceAll('__VERSION__', VERSION))
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), versionApp()],
  define: { __VERSION_APP__: JSON.stringify(VERSION) },
  // Librerías en archivos propios: casi nunca cambian, así que el celular las guarda en caché entre versiones
  // y en cada despliegue solo descarga el código de la aplicación.
  build: {
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler)[\/]/ },
            { name: 'animaciones', test: /node_modules[\/](motion|framer-motion|motion-dom|motion-utils)[\/]/ },
            { name: 'iconos', test: /node_modules[\/]lucide-react[\/]/ },
          ],
        },
      },
    },
  },
  server: { port: 5173, strictPort: true, proxy: API_LOCAL },
  // App instalable en el celular (npm run celular:app): build de producción servido aquí y abierto por un túnel HTTPS
  preview: { port: 4173, strictPort: true, proxy: API_LOCAL, allowedHosts: ['.trycloudflare.com'] },
})
