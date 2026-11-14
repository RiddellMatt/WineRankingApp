import { useId } from 'react'

/** Upright wine glass: stream from above into the rim; level rises in the bowl only. */
export function ScanPourGlass() {
  const uid = useId().replace(/:/g, '')
  const bowlClip = `scan-pour-bowl-${uid}`
  const wineGrad = `scan-wine-grad-${uid}`
  const glowGrad = `scan-glow-grad-${uid}`

  const bowlCup =
    'M36 72 C36 36 52 18 70 18 S104 36 104 72 C104 94 94 108 80 116 L60 116 C46 108 36 94 36 72 Z'

  const glassOutline =
    'M36 72 C36 36 52 18 70 18 S104 36 104 72 C104 94 94 108 80 116 L60 116 C46 108 36 94 36 72 Z M64 116 L64 152 M50 166 H90'

  const bowlBottomY = 116
  const fillMax = 92
  const rimY = 22
  const pourStartY = -32
  const pourEndY = rimY + 4

  return (
    <svg
      className="scan-pour-glass-svg"
      viewBox={`0 ${pourStartY - 8} 140 ${188 - pourStartY + 16}`}
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
        <radialGradient id={glowGrad} cx="50%" cy="55%" r="48%">
          <stop offset="0%" stopColor="#c25747" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#c25747" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="70" cy="80" rx="44" ry="48" fill={`url(#${glowGrad})`} className="scan-pour-svg-glow" />

      <g clipPath={`url(#${bowlClip})`}>
        <rect
          x="28"
          y={bowlBottomY}
          width="84"
          height="0"
          fill={`url(#${wineGrad})`}
        >
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
        <ellipse cx="70" cy={bowlBottomY - fillMax} rx="40" ry="7" fill="#f5c9bf" opacity="0.92">
          <animate
            attributeName="cy"
            values={`${rimY + 6};${bowlBottomY - fillMax};${bowlBottomY - fillMax};${rimY + 6}`}
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
        <ellipse cx="56" cy="78" rx="10" ry="18" fill="#fff" opacity="0.18" />
      </g>

      <path
        d={glassOutline}
        fill="none"
        stroke="#faf4f5"
        strokeWidth="3.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="scan-pour-svg-outline"
      />

      <g className="scan-pour-svg-stream-group">
        <path
          d={`M70 ${pourStartY} L70 ${pourEndY}`}
          fill="none"
          stroke="#c25747"
          strokeWidth="7"
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
          strokeWidth="2"
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
        <ellipse cx="70" cy={pourStartY + 2} rx="5" ry="3" fill="#e88a7a" opacity="0">
          <animate
            attributeName="opacity"
            values="0;0.85;0.85;0"
            keyTimes="0;0.1;0.4;0.55"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </ellipse>
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