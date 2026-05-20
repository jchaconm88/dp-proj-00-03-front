import { defineConfig } from 'astro/config'
import node from '@astrojs/node'

export default defineConfig({
  // Modo output: hybrid permite SSG por defecto con SSR para rutas dinamicas
  output: 'hybrid',

  adapter: node({
    mode: 'standalone',
  }),

  // Dev y preview (SSR Node) comparten server.* — Req multi-dominio en local
  // host: true en preview se convierte en undefined y el adapter escucha solo "localhost";
  // en Windows/Git Bash 127.0.0.1 y mi-cliente.local fallan. Usar 0.0.0.0 explícito.
  server: {
    port: 4321,
    host: '0.0.0.0',
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
    ssr: {
      // Empaquetar dependencias usadas en SSR para no depender de node_modules en Docker
      noExternal: ['mustache'],
    },
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
