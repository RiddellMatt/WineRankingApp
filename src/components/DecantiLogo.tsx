import { BrandMark } from './BrandMark'
import { useAppTheme } from '../lib/useAppTheme'
import { THEME_OPTIONS } from '../lib/themes'

interface Props {
  className?: string
  /** Compact app header vs larger auth card. */
  context?: 'header' | 'auth'
  /** Header lockup uses the cropped wordmark instead of the square theme canvas. */
  wordmark?: boolean
}

function logoSrcForTheme(
  theme: ReturnType<typeof useAppTheme>,
  wordmark: boolean,
): string | undefined {
  const option = THEME_OPTIONS.find((item) => item.id === theme)
  if (wordmark && option?.wordmarkSrc) return option.wordmarkSrc
  return option?.logoSrc
}

/** Theme-aware Decanti mark — wordmark on Red & White themes (see theme logoSrc). */
export function DecantiLogo({ className = '', context = 'header', wordmark = false }: Props) {
  const theme = useAppTheme()
  const logoSrc = logoSrcForTheme(theme, wordmark)

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
  const markClass = context === 'auth' ? 'auth-brand-mark' : 'brand-mark-header'

  return (
    <BrandMark
      className={`decanti-logo decanti-logo-classic decanti-logo-${context} ${markClass} ${className}`.trim()}
      size={size}
    />
  )
}

export function usesThemeWordmarkLogo(theme: ReturnType<typeof useAppTheme>): boolean {
  return theme === 'classic' || theme === 'light'
}
