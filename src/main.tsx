import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppLaunchOverlay } from './components/AppLaunchOverlay.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { migrateLegacyStorageKeys } from './lib/storageMigrate.ts'
import { initAppIcon } from './lib/appIcon.ts'
import { initTheme } from './lib/themes.ts'
import { initNativeShell } from './mobile/initNativeShell.ts'

migrateLegacyStorageKeys()
initTheme()
void initAppIcon()
void initNativeShell()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <AppLaunchOverlay />
    </AuthProvider>
  </StrictMode>,
)
