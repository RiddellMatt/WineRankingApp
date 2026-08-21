import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.northline.decanti',
  appName: 'Decanti',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    scheme: 'Decanti',
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
      backgroundColor: '#12080c',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#12080c',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
}

export default config
