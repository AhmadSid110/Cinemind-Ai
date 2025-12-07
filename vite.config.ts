// vite.config.ts or vite.config.js
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    plugins: [
      react(),

      // 🔋 PWA + Caching
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false, // keep SW disabled in dev; use `npm run preview` to test PWA
        },
        includeAssets: [
          'favicon.ico',
          'robots.txt',
          'apple-touch-icon.png',
        ],
        // If you already have public/manifest.webmanifest or manifest.json,
        // this can mirror it; otherwise this will generate one.
        manifest: {
          id: '/',
          name: 'CineRank AI - Movie & TV Discovery',
          short_name: 'CineRank AI',
          description:
            'AI-powered movie and TV show discovery app with intelligent recommendations',
          start_url: './',
          scope: './',
          display: 'standalone',
          background_color: '#020617',
          theme_color: '#06b6d4',
          orientation: 'any',
          categories: ['entertainment', 'lifestyle'],
          icons: [
            {
              src: './icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable any',
            },
            {
              src: './icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable any',
            },
          ],
          screenshots: [
            {
              src: './screens/screenshot-mobile.png',
              sizes: '540x720',
              type: 'image/png',
              form_factor: 'narrow',
            },
          ],
          shortcuts: [
            {
              name: 'Search Movies',
              short_name: 'Search',
              description: 'Search for movies and TV shows',
              url: '/?action=search',
              icons: [
                {
                  src: './icons/icon-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
            {
              name: 'Trending Now',
              short_name: 'Trending',
              description: 'View trending content',
              url: '/?action=trending',
              icons: [
                {
                  src: './icons/icon-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
          runtimeCaching: [
            // 🎞 Cache TMDB images (poster/backdrop/stills)
            {
              urlPattern: /^https:\/\/image\.tmdb\.org\/t\/p\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'tmdb-images',
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // 📡 Cache TMDB API calls (network-first for fresher data)
            {
              urlPattern: /^https:\/\/api\.themoviedb\.org\/3\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'tmdb-api',
                networkTimeoutSeconds: 3,
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // 🔁 Fallback for other same-origin requests
            {
              urlPattern: ({ url }) => url.origin === self.location.origin,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'app-shell',
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
      // keep your env wiring
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // if you want OpenAI from .env too, you can add:
      // 'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});