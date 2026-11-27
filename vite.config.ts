import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isMobile = mode === 'mobile'

  return {
    // Capacitor loads bundled assets from the app filesystem (relative paths).
    // The public site is served at the root of decantiwine.com, including the
    // GitHub Pages build, so web assets stay at /.
    base: isMobile ? './' : '/',
    plugins: [
      react(),
      {
        name: 'decanti-native-app-html-class',
        transformIndexHtml(html) {
          if (!isMobile) return html
          return html.replace('<html lang="en">', '<html lang="en" class="native-app">')
        },
      },
      ...(isMobile
        ? []
        : [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
              workbox: {
                // The Android sign-in return page must stay this file, not the app shell.
                navigateFallbackDenylist: [
                  /^\/login-callback\.html$/,
                  /^\/share\.html$/,
                  /^\/wine-journal\.html$/,
                  /^\/restaurant-wine-list\.html$/,
                  /^\/cellar-tracker\.html$/,
                  /^\/privacy\.html$/,
                  /^\/terms\.html$/,
                ],
              },
              manifest: {
                name: 'Decanti',
                short_name: 'Decanti',
                description:
                  'Decanti is a wine ranking app. Rate every bottle you try, keep a want-to-try list, and share your cellar with friends.',
                theme_color: '#12080c',
                background_color: '#12080c',
                display: 'standalone',
                icons: [
                  { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
                  { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
                  {
                    src: 'icons/pwa-512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                  },
                ],
              },
            }),
          ]),
    ],
  }
})
