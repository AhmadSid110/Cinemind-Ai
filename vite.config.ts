import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        // We already have manifest.json in public/, so we don't need to redefine it here.
        // This just controls what gets cached and how.
        workbox: {
          // Precache all built assets + manifest/icons
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json}'],

          runtimeCaching: [
            {
              // TMDB API responses - keep them fresh-ish but still cached
              urlPattern: /^https:\/\/api\.themoviedb\.org\/3\//,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'tmdb-api',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 1 day
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // TMDB images - image cache for smoother scrolling
              urlPattern: /^https:\/\/image\.tmdb\.org\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'tmdb-images',
                expiration: {
                  maxEntries: 150,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],
    define: {
      // Gemini (already there)
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),

      // Optional: OpenAI if you want env-based config later
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      // Small perf tweaks for production
      sourcemap: false,
      rollupOptions: {
        output: {
          // Let Vite decide chunks automatically (good default for your use case)
        },
      },
    },
  };
});