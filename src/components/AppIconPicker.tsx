import { useEffect, useState } from 'react'
import {
  APP_ICON_OPTIONS,
  applyAppIcon,
  isAppIconChangeSupported,
  loadStoredAppIcon,
  type AppIconVariant,
} from '../lib/appIcon'
import { isNativeApp } from '../lib/platform'

export function AppIconPicker() {
  const [icon, setIcon] = useState<AppIconVariant>(() => loadStoredAppIcon())
  const [nativeSupported, setNativeSupported] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isNativeApp()) {
      setNativeSupported(false)
      return
    }
    void isAppIconChangeSupported().then(setNativeSupported)
  }, [])

  async function choose(next: AppIconVariant) {
    if (next === icon || busy) return
    setBusy(true)
    setIcon(next)
    try {
      await applyAppIcon(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-icon-picker">
      <div className="theme-picker">
        {APP_ICON_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`theme-option ${icon === option.id ? 'active' : ''}`}
            aria-pressed={icon === option.id}
            disabled={busy}
            onClick={() => void choose(option.id)}
          >
            <span className="theme-preview theme-preview-logo" aria-hidden="true">
              <img src={option.previewSrc} alt="" className="theme-preview-img" />
            </span>
            <span className="theme-option-copy">
              <span className="theme-option-label">{option.label}</span>
              <span className="theme-option-desc">{option.description}</span>
            </span>
          </button>
        ))}
      </div>
      {nativeSupported === false && (
        <p className="account-hint">
          {isNativeApp()
            ? 'Requires an app update with alternate icons enabled.'
            : 'Use the Decanti app to change your home screen icon.'}
        </p>
      )}
    </div>
  )
}
