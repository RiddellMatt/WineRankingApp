import { useState } from 'react'
import { applyTheme, loadStoredTheme, THEME_OPTIONS, type AppTheme } from '../lib/themes'

export function ThemePicker() {
  const [theme, setTheme] = useState<AppTheme>(() => loadStoredTheme())

  function choose(next: AppTheme) {
    setTheme(next)
    applyTheme(next)
  }

  return (
    <div className="theme-picker">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`theme-option ${theme === option.id ? 'active' : ''}`}
          onClick={() => choose(option.id)}
          aria-pressed={theme === option.id}
        >
          <span className="theme-preview" aria-hidden="true">
            <img src={option.previewSrc} alt="" className="theme-preview-img" />
          </span>
          <span className="theme-option-copy">
            <span className="theme-option-label">{option.label}</span>
            <span className="theme-option-desc">{option.description}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
