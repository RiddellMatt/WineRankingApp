import { THEME_OPTIONS, type AppTheme } from '../lib/themes'

interface Props {
  theme: AppTheme
  disabled?: boolean
  onChange: (theme: AppTheme) => void
}

export function ThemePicker({ theme, disabled = false, onChange }: Props) {
  return (
    <div className="theme-picker">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`theme-option ${theme === option.id ? 'active' : ''}`}
          onClick={() => onChange(option.id)}
          aria-pressed={theme === option.id}
          disabled={disabled}
        >
          <span className={`theme-preview${option.logoSrc ? ' theme-preview-logo' : ''}`} aria-hidden="true">
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
