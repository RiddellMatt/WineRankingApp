/// <reference types="@capawesome/capacitor-tab-bar" />
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.northline.decanti',
  appName: 'Decanti',
  webDir: 'dist',
  ios: {
    // CSS env(safe-area-inset-*) handles insets; automatic double-applies and jumps on launch.
    contentInset: 'never',
    scheme: 'Decanti',
    // WKWebView underlay (overscroll / safe areas); classic theme --bg
    backgroundColor: '#12080c',
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
      launchFadeOutDuration: 480,
      backgroundColor: '#ffffff',
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
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    TabBar: {
      selectedColor: '#c41e3a',
    },
  },
}

export default config
