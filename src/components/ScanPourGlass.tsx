import { useId } from 'react'

/** Wine glass: pour enters at rim; fill rises inside the bowl only (not from the stem). */
export function ScanPourGlass() {
  const uid = useId().replace(/:/g, '')
  const bowlClip = `scan-pour-bowl-${uid}`
  const wineGrad = `scan-wine-grad-${uid}`
  const glowGrad = `scan-glow-grad-${uid}`

  /** Bowl cup only (no stem) — liquid clip. */
  const bowlCup =
    'M36 72 C36 36 52 18 70 18 S104 36 104 72 C104 94 94 108 80 116 L60 116 C46 108 36 94 36 72 Z'

  const glassOutline =
    'M36 72 C36 36 52 18 70 18 S104 36 104 72 C104 94 94 108 80 116 L60 116 C46 108 36 94 36 72 Z M64 116 L64 152 M50 166 H90'

  const rimY = 22
  const bowlBottomY = 116
  const pourEndY = 30

  return (
    <svg
      className="scan-pour-glass-svg"
      viewBox="0 0 140 188"
      width={140}
      height={188}
      aria-hidden
    >
      <defs>
        <clipPath id={bowlClip}>
          <path d={bowlCup} />
        </clipPath>
        <linearGradient id={wineGrad} x1="0" y1="0" x2="0.2" y2="1">
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
        <g transform={`translate(70 ${bowlBottomY})`}>
          <g>
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1 0.04; 1 0.92; 1 0.92; 1 0.06"
              keyTimes="0;0.36;0.72;1"
              dur="4.2s"
              repeatCount="indefinite"
            />
            <rect x="-42" y="-98" width="84" height="98" fill={`url(#${wineGrad})`} />
            <ellipse cx="0" cy="-98" rx="40" ry="7" fill="#f5c9bf" opacity="0.92" />
            <ellipse cx="-14" cy="-58" rx="10" ry="18" fill="#fff" opacity="0.2" />
          </g>
        </g>
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
          d={`M70 0 L70 ${pourEndY}`}
          fill="none"
          stroke="#c25747"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray="32"
          strokeDashoffset="32"
          opacity="0.95"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="32;0;0;32"
            keyTimes="0;0.38;0.72;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.2;1;1;0.15"
            keyTimes="0;0.15;0.72;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </path>
        <path
          d={`M70 0 L70 ${pourEndY}`}
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="32"
          strokeDashoffset="32"
          opacity="0.45"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="32;0;0;32"
            keyTimes="0;0.38;0.72;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </path>
        <circle fill="#e88a7a" r="4" cx="70" cy="8">
          <animate
            attributeName="cy"
            values={`4;${rimY + 4};4`}
            keyTimes="0;0.45;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;0"
            keyTimes="0;0.12;0.5"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  )
}