import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.northline.cellarrank',
  appName: 'Cellar Rank',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    scheme: 'Cellar Rank',
  },
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'accounts.google.com',
      'www.google.com',
      '*.google.com',
      '*.googleapis.com',
      'appleid.apple.com',
      '*.supabase.co',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      backgroundColor: '#16090d',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#16090d',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
}

export default config
