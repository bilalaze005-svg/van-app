import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // نستخدم manifest.json الموجود بدل توليد واحد جديد
      manifest: false,
      includeManifestIcons: false,
      workbox: {
        // كاش app-shell (JS/CSS/HTML) حتى يفتح التطبيق دون إنترنت
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // صور المنتجات القادمة من Supabase Storage: كاش لفترة محدودة
        // حتى تظهر الصور حتى لو ضعف الاتصال أثناء الجولة
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        }
      }
    }
  },
  server: {
    host: true,
    open: true,
  }
})
