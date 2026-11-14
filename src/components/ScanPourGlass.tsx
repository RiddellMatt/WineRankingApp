import { useId } from 'react'

/** Angular modern wine glass — continuous bowl-to-stem taper; pour into rim. */
export function ScanPourGlass() {
  const uid = useId().replace(/:/g, '')
  const bowlClip = `scan-pour-bowl-${uid}`
  const wineGrad = `scan-wine-grad-${uid}`
  const glowGrad = `scan-glow-grad-${uid}`

  const rimY = 26
  const bowlBottomY = 100
  const fillMax = bowlBottomY - rimY - 6
  const pourStartY = -34
  const pourEndY = rimY + 2

  /** Bowl interior only (angular / bordeaux silhouette). */
  const bowlCup =
    'M48 27H92L105 53L74 96Q70 100 66 96L35 53L48 27Z'

  /** Single outline: rim → shoulders → bowl floor → stem → foot (no gap at junction). */
  const glassOutline =
    'M46 25H94L108 54L76 98Q70 101 64 98L32 54L46 25M70 101C70 105 70 118 70 152M52 158Q70 166 88 158'

  /** Left-edge crystal highlight. */
  const glassSheen = 'M50 28L38 52L64 94'

  return (
    <svg
      className="scan-pour-glass-svg"
      viewBox={`0 ${pourStartY - 8} 140 ${168 - pourStartY + 28}`}
      width={140}
      height={188}
      aria-hidden
    >
      <defs>
        <clipPath id={bowlClip}>
          <path d={bowlCup} />
        </clipPath>
        <linearGradient id={wineGrad} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor="#e88a7a" />
          <stop offset="50%" stopColor="#c25747" />
          <stop offset="100%" stopColor="#7a2f28" />
        </linearGradient>
        <radialGradient id={glowGrad} cx="50%" cy="48%" r="46%">
          <stop offset="0%" stopColor="#c25747" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#c25747" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="70" cy="68" rx="42" ry="44" fill={`url(#${glowGrad})`} className="scan-pour-svg-glow" />

      <g clipPath={`url(#${bowlClip})`}>
        <rect x="34" y={bowlBottomY} width="72" height="0" fill={`url(#${wineGrad})`}>
          <animate
            attributeName="height"
            values={`0;${fillMax};${fillMax};0`}
            keyTimes="0;0.36;0.72;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="y"
            values={`${bowlBottomY};${bowlBottomY - fillMax};${bowlBottomY - fillMax};${bowlBottomY}`}
            keyTimes="0;0.36;0.72;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </rect>
        <ellipse cx="70" cy={bowlBottomY - fillMax} rx="22" ry="5.5" fill="#f5c9bf" opacity="0.92">
          <animate
            attributeName="cy"
            values={`${rimY + 5};${bowlBottomY - fillMax};${bowlBottomY - fillMax};${rimY + 5}`}
            keyTimes="0;0.36;0.72;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;0.92;0.92;0"
            keyTimes="0;0.2;0.72;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </ellipse>
        <path d="M58 42L54 88" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.14" />
      </g>

      <path
        d={glassOutline}
        fill="none"
        stroke="#f3ecef"
        strokeWidth="3.2"
        strokeLinejoin="miter"
        strokeLinecap="round"
        className="scan-pour-svg-outline"
      />
      <path
        d={glassSheen}
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
        className="scan-pour-svg-sheen"
      />

      <g className="scan-pour-svg-stream-group">
        <path
          d={`M70 ${pourStartY} L70 ${pourEndY}`}
          fill="none"
          stroke="#c25747"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={pourEndY - pourStartY}
          strokeDashoffset={pourEndY - pourStartY}
          opacity="0.95"
        >
          <animate
            attributeName="stroke-dashoffset"
            values={`${pourEndY - pourStartY};0;0;${pourEndY - pourStartY}`}
            keyTimes="0;0.38;0.72;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.15;1;1;0.1"
            keyTimes="0;0.12;0.72;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </path>
        <path
          d={`M70 ${pourStartY} L70 ${pourEndY}`}
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray={pourEndY - pourStartY}
          strokeDashoffset={pourEndY - pourStartY}
          opacity="0.45"
        >
          <animate
            attributeName="stroke-dashoffset"
            values={`${pourEndY - pourStartY};0;0;${pourEndY - pourStartY}`}
            keyTimes="0;0.38;0.72;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </path>
        <circle fill="#e88a7a" r="3.5" cx="70" cy={pourStartY + 8}>
          <animate
            attributeName="cy"
            values={`${pourStartY + 4};${pourEndY - 2};${pourStartY + 4}`}
            keyTimes="0;0.45;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;0"
            keyTimes="0;0.1;0.48"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  )
}