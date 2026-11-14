import { useId } from 'react'

/** Angular modern wine glass — continuous bowl-to-stem taper; pour into rim. */
export function ScanPourGlass() {
  const uid = useId().replace(/:/g, '')
  const bowlClip = `scan-pour-bowl-${uid}`
  const wineGrad = `scan-wine-grad-${uid}`
  const glowGrad = `scan-glow-grad-${uid}`
  const pourGrad = `scan-pour-grad-${uid}`
  const pourClip = `scan-pour-clip-${uid}`

  const rimY = 26
  const bowlBottomY = 100
  const fillMax = bowlBottomY - rimY - 6
  const pourStartY = -36
  const pourEndY = rimY + 2
  const pourSpan = pourEndY - pourStartY

  /** Bowl interior only (angular / bordeaux silhouette). */
  const bowlCup =
    'M48 27H92L105 53L74 96Q70 100 66 96L35 53L48 27Z'

  /** Single outline: rim → shoulders → bowl floor → stem → foot (no gap at junction). */
  const glassOutline =
    'M46 25H94L108 54L76 98Q70 101 64 98L32 54L46 25M70 101C70 105 70 118 70 152M52 158Q70 166 88 158'

  /** Left-edge crystal highlight. */
  const glassSheen = 'M50 28L38 52L64 94'

  /** Tapered pour ribbon — wide at source, narrow at rim with a soft curve. */
  const pourRibbon =
    'M63.5 -36C61.5 -14 60.5 6 67.5 28L72.5 28C79.5 6 78.5 -14 76.5 -36Z'

  return (
    <svg
      className="scan-pour-glass-svg"
      viewBox={`0 ${pourStartY - 12} 140 ${168 - pourStartY + 32}`}
      width={140}
      height={188}
      aria-hidden
    >
      <defs>
        <clipPath id={bowlClip}>
          <path d={bowlCup} />
        </clipPath>
        <clipPath id={pourClip}>
          <rect x="56" y={pourStartY} width="28" height="0">
            <animate
              attributeName="height"
              values={`0;${pourSpan};${pourSpan};0`}
              keyTimes="0;0.38;0.72;1"
              dur="4.2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="y"
              values={`${pourStartY};${pourStartY};${pourStartY};${pourStartY}`}
              keyTimes="0;0.38;0.72;1"
              dur="4.2s"
              repeatCount="indefinite"
            />
          </rect>
        </clipPath>
        <linearGradient id={wineGrad} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor="#e88a7a" />
          <stop offset="50%" stopColor="#c25747" />
          <stop offset="100%" stopColor="#7a2f28" />
        </linearGradient>
        <linearGradient id={pourGrad} x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0%" stopColor="#8f3d32" stopOpacity="0.85" />
          <stop offset="35%" stopColor="#c25747" />
          <stop offset="62%" stopColor="#ddb0a6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#9a4035" stopOpacity="0.95" />
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
        <ellipse cx="70" cy={pourStartY - 5} rx="11" ry="4" fill="#b04a3e" opacity="0">
          <animate
            attributeName="opacity"
            values="0;0.75;0.75;0"
            keyTimes="0;0.1;0.38;0.55"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </ellipse>

        <g clipPath={`url(#${pourClip})`} opacity="0.96">
          <path d={pourRibbon} fill={`url(#${pourGrad})`} />
          <path
            d="M69 -34C68 -8 68 10 70 26"
            fill="none"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.35"
          />
        </g>

        <ellipse cx="70" cy={rimY + 1} rx="10" ry="2.5" fill="#c25747" opacity="0">
          <animate
            attributeName="opacity"
            values="0;0;0.45;0.2;0"
            keyTimes="0;0.34;0.42;0.55;0.72"
            dur="4.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="rx"
            values="6;6;16;12;6"
            keyTimes="0;0.34;0.42;0.55;0.72"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </ellipse>

        <circle fill="#ddb0a6" r="2" cx="72" cy={rimY + 3} opacity="0">
          <animate
            attributeName="opacity"
            values="0;0;0.8;0"
            keyTimes="0;0.4;0.48;0.58"
            dur="4.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="cy"
            values={`${rimY + 2};${rimY + 2};${rimY + 8};${rimY + 14}`}
            keyTimes="0;0.4;0.48;0.58"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  )
}