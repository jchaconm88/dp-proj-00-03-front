import { defineConfig } from 'astro/config'
import node from '@astrojs/node'

export default defineConfig({
  // Modo output: hybrid permite SSG por defecto con SSR para rutas dinamicas
  output: 'hybrid',

  adapter: node({
    mode: 'standalone',
  }),

  // Servidor de desarrollo
  server: {
    port: 4321,
    host: true,
  },

  // Optimizacion de imagenes
  image: {
    // Servir imagenes optimizadas en WebP/AVIF — Req 6.3
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
  },

  // Integraciones
  integrations: [],

  // Compresion de assets
  compressHTML: true,

  // Vite config para optimizacion
  vite: {
    server: {
      // Dominios de tenant en hosts (ej. mi-cliente.local); Vite 6+ bloquea hosts no listados
      allowedHosts: true,
    },
    build: {
      rollupOptions: {
        output: {
          // Cache-busting con hash en nombre de archivo
          chunkFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },
    },
  },
})
