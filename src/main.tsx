import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { migrateLegacyStorageKeys } from './lib/storageMigrate.ts'
import { initNativeShell } from './mobile/initNativeShell.ts'

migrateLegacyStorageKeys()
void initNativeShell()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
