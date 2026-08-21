import { BrandMark } from './BrandMark'
import { useAppTheme } from '../lib/useAppTheme'
import { THEME_OPTIONS } from '../lib/themes'

interface Props {
  className?: string
  /** Compact app header vs larger auth card. */
  context?: 'header' | 'auth'
}

function logoSrcForTheme(theme: ReturnType<typeof useAppTheme>): string | undefined {
  return THEME_OPTIONS.find((option) => option.id === theme)?.logoSrc
}

/** Theme-aware Decanti mark — decanter for Cellar, wordmark logos for Navy/Daylight. */
export function DecantiLogo({ className = '', context = 'header' }: Props) {
  const theme = useAppTheme()
  const logoSrc = logoSrcForTheme(theme)

  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt="Decanti"
        className={`decanti-logo decanti-logo-${theme} decanti-logo-${context} ${className}`.trim()}
        decoding="async"
      />
    )
  }

  const size = context === 'auth' ? 56 : 44
  const markClass =
    context === 'auth' ? 'auth-brand-mark' : 'brand-mark-header'

  return (
    <BrandMark
      className={`decanti-logo decanti-logo-classic decanti-logo-${context} ${markClass} ${className}`.trim()}
      size={size}
    />
  )
}

export function usesThemeWordmarkLogo(theme: ReturnType<typeof useAppTheme>): boolean {
  return theme === 'navy' || theme === 'light'
}
