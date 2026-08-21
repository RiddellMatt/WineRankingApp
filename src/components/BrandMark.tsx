interface Props {
  className?: string
  size?: number
}

/** Decanter mark for headers, auth, and favicon-style spots. */
export function BrandMark({ className = '', size = 40 }: Props) {
  return (
    <svg
      className={`brand-mark ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="decanti-mark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f4d58d" />
          <stop offset="45%" stopColor="#e8b04b" />
          <stop offset="100%" stopColor="#b62c4a" />
        </linearGradient>
      </defs>
      <path
        fill="url(#decanti-mark)"
        d="M30 4h4c0 10-1.5 16-4 19v22h-6a2.5 2.5 0 0 0 0 5h20a2.5 2.5 0 0 0 0-5h-6V23c-2.5-3-4-9-4-19z"
      />
      <path
        fill="#f3e6e9"
        opacity="0.22"
        d="M32 10c1.5 4 2 8 2 12v8h-4V22c0-4 .5-8 2-12z"
      />
      <ellipse cx="32" cy="52" rx="14" ry="3.5" fill="#b62c4a" opacity="0.35" />
    </svg>
  )
}
