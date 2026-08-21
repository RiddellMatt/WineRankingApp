import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isMobile = mode === 'mobile'
  const isGhPages = process.env.GITHUB_PAGES === 'true'

  return {
    // Capacitor loads bundled assets from the app filesystem (relative paths).
    base: isMobile ? './' : isGhPages ? '/WineRankingApp/' : '/',
    plugins: [
      react(),
      ...(isMobile
        ? []
        : [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
              manifest: {
                name: 'Decanti',
                short_name: 'Decanti',
                description: "Decanti — rank, remember, and share every wine you've tried.",
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
