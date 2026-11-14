import { useId } from 'react'

/** Angular wine glass + angled curved pour (bottle off upper-right). */
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
  const pourTopY = -42
  const impactX = 73
  const impactY = rimY + 1
  const pourLen = 82
  const pourAngle = 34
  const sourceX = 100
  const sourceY = pourTopY

  const bowlCup = 'M48 27H92L105 53L74 96Q70 100 66 96L35 53L48 27Z'
  const glassOutline =
    'M46 25H94L108 54L76 98Q70 101 64 98L32 54L46 25M70 101C70 105 70 118 70 152M52 158Q70 166 88 158'
  const glassSheen = 'M50 28L38 52L64 94'

  /** Curved ribbon: wide at bottle lip, narrow where it hits the rim. */
  const pourRibbon =
    'M104 -41C103 -24 92 -2 80 20L72 27C84 6 96 -16 98 -39Z'

  /** Thinner offset stream — sells fluid separation / viscosity. */
  const pourWisp =
    'M100 -39C98 -20 89 0 76 23L71 27C85 4 94 -14 96 -36Z'

  /** Bottle lip hint above the frame. */
  const bottleLip = 'M106 -46L112 -44L110 -40L102 -41Z'

  return (
    <svg
      className="scan-pour-glass-svg"
      viewBox={`0 ${pourTopY - 14} 140 ${168 - pourTopY + 36}`}
      width={140}
      height={188}
      aria-hidden
    >
      <defs>
        <clipPath id={bowlClip}>
          <path d={bowlCup} />
        </clipPath>
        <clipPath id={pourClip} clipPathUnits="userSpaceOnUse">
          <g transform={`rotate(${pourAngle} ${sourceX} ${sourceY})`}>
            <rect x={sourceX - 14} y={sourceY - 2} width="28" height="0">
              <animate
                attributeName="height"
                values={`0;${pourLen};${pourLen};0`}
                keyTimes="0;0.38;0.72;1"
                dur="4.2s"
                repeatCount="indefinite"
              />
            </rect>
          </g>
        </clipPath>
        <linearGradient id={wineGrad} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor="#e88a7a" />
          <stop offset="50%" stopColor="#c25747" />
          <stop offset="100%" stopColor="#7a2f28" />
        </linearGradient>
        <linearGradient
          id={pourGrad}
          gradientUnits="userSpaceOnUse"
          x1="104"
          y1="-40"
          x2="72"
          y2="26"
        >
          <stop offset="0%" stopColor="#7a3228" stopOpacity="0.75" />
          <stop offset="28%" stopColor="#b2483c" />
          <stop offset="55%" stopColor="#e8b5ab" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#8c382f" />
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
          d={bottleLip}
          fill="#d8d0d2"
          opacity="0.55"
          transform={`rotate(${pourAngle - 8} 106 -43)`}
        />

        <ellipse
          cx={sourceX}
          cy={sourceY}
          rx="12"
          ry="5"
          fill="#9c4137"
          opacity="0"
          transform={`rotate(${pourAngle - 6} ${sourceX} ${sourceY})`}
        >
          <animate
            attributeName="opacity"
            values="0;0.8;0.8;0"
            keyTimes="0;0.1;0.38;0.55"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </ellipse>

        <g clipPath={`url(#${pourClip})`}>
          <path d={pourRibbon} fill={`url(#${pourGrad})`} opacity="0.97" />
          <path d={pourWisp} fill="#a84438" opacity="0.28" />
          <path
            d="M101 -39C95 -14 84 4 75 24"
            fill="none"
            stroke="#fff"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.4"
          />
        </g>

        <ellipse cx={impactX} cy={impactY} rx="9" ry="2.4" fill="#c25747" opacity="0">
          <animate
            attributeName="opacity"
            values="0;0;0.5;0.25;0"
            keyTimes="0;0.34;0.42;0.55;0.72"
            dur="4.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="rx"
            values="5;5;14;11;5"
            keyTimes="0;0.34;0.42;0.55;0.72"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </ellipse>

        <circle fill="#e8b5ab" r="1.8" cx={impactX - 1} cy={impactY + 2} opacity="0">
          <animate
            attributeName="opacity"
            values="0;0;0.85;0"
            keyTimes="0;0.4;0.48;0.58"
            dur="4.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="cx"
            values={`${impactX - 1};${impactX - 1};${impactX - 6};${impactX - 10}`}
            keyTimes="0;0.4;0.48;0.58"
            dur="4.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="cy"
            values={`${impactY + 2};${impactY + 2};${impactY + 8};${impactY + 14}`}
            keyTimes="0;0.4;0.48;0.58"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  )
}