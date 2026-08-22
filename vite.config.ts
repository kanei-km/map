import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// maplibre-glはワーカー(と共有チャンク)のURLを実行時に動的な文字列で組み立てるため、
// Viteのビルドがこれらのファイルを自動検出できない。ビルド成果物に手動で含める。
function copyMaplibreWorkerPlugin(): Plugin {
  const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']
  return {
    name: 'copy-maplibre-gl-worker',
    generateBundle() {
      for (const file of files) {
        const filePath = fileURLToPath(
          new URL(`./node_modules/maplibre-gl/dist/${file}`, import.meta.url),
        )
        this.emitFile({
          type: 'asset',
          fileName: `assets/${file}`,
          source: readFileSync(filePath),
        })
      }
    },
  }
}

const base = '/map/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    copyMaplibreWorkerPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '日光国立公園あるき道',
        short_name: 'あるき道',
        description: '日光国立公園の歩行ルートと現在地をオフラインでも確認できる実証版PWA',
        lang: 'ja',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#1f3d2b',
        theme_color: '#1f3d2b',
        icons: [
          {
            src: `${base}icons/icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}icons/icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: `${base}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,webmanifest,json,geojson}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cyberjapandata\.gsi\.go\.jp\/xyz\/pale\/.*\.png$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-v1',
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  worker: {
    format: 'es',
  },
})
