import { useId } from 'react'

/** Wine glass with SMIL pour stream + rising fill (hero on ScanPourOverlay). */
export function ScanPourGlass() {
  const uid = useId().replace(/:/g, '')
  const bowlClip = `scan-pour-bowl-${uid}`
  const wineGrad = `scan-wine-grad-${uid}`
  const glowGrad = `scan-glow-grad-${uid}`

  const bowlPath =
    'M32 78 c0-38 16-58 38-58s38 20 38 58c0 22-10 36-24 44v36h-28v-36c-14-8-24-22-24-44z'

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
          <path d={bowlPath} />
        </clipPath>
        <linearGradient id={wineGrad} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="#e88a7a" />
          <stop offset="45%" stopColor="#c25747" />
          <stop offset="100%" stopColor="#7a2f28" />
        </linearGradient>
        <radialGradient id={glowGrad} cx="50%" cy="60%" r="50%">
          <stop offset="0%" stopColor="#c25747" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#c25747" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="70" cy="88" rx="46" ry="52" fill={`url(#${glowGrad})`} className="scan-pour-svg-glow" />

      <g clipPath={`url(#${bowlClip})`}>
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 118;0 0;0 0;0 110"
            keyTimes="0;0.32;0.68;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
          <rect x="26" y="44" width="88" height="132" fill={`url(#${wineGrad})`} />
          <ellipse cx="70" cy="46" rx="40" ry="8" fill="#f5c9bf" opacity="0.9" />
          <ellipse cx="48" cy="92" rx="12" ry="22" fill="#fff" opacity="0.22" />
        </g>
      </g>

      <path
        d={bowlPath}
        fill="none"
        stroke="#faf4f5"
        strokeWidth="3.8"
        strokeLinejoin="round"
        className="scan-pour-svg-outline"
      />

      <g className="scan-pour-svg-stream-group">
        <path
          d="M70 0 L70 58"
          fill="none"
          stroke="#c25747"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray="58"
          strokeDashoffset="58"
          opacity="0.95"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="58;0;0;58"
            keyTimes="0;0.4;0.72;1"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </path>
        <path
          d="M70 0 L70 58"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="58"
          strokeDashoffset="58"
          opacity="0.4"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="58;0;0;58"
            keyTimes="0;0.4;0.72;1"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </path>
        <circle fill="#e88a7a" r="4.5" cx="70" cy="8">
          <animate attributeName="cy" values="4;56;4" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;0" dur="1.6s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  )
}