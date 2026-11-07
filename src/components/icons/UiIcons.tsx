interface IconProps {
  className?: string
  size?: number
}

const defaultSize = 18

/** SF Symbol–style square.and.arrow.up (open tray, arrow up through gap). */
export function IconShare({ className = 'ui-icon', size = defaultSize }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v8.25" />
      <path d="M9.25 6.25 12 3.5 14.75 6.25" />
      <path d="M8.25 11.75H6.5a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4.25a2 2 0 0 0-2-2H15.75" />
    </svg>
  )
}

export function IconBell({ className = 'ui-icon', size = defaultSize }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

/** Where you bought it — not a shopping cart. */
export function IconMapPin({ className = 'ui-icon', size = 16 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s-6-5.15-6-10a6 6 0 1 1 12 0c0 4.85-6 10-6 10" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  )
}

/** Open in browser / find on the web (Safari-style globe). */
export function IconGlobe({ className = 'ui-icon', size = defaultSize }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.9 4 6.4 4 9s-1.5 6.1-4 9" />
      <path d="M12 3c-2.5 2.9-4 6.4-4 9s1.5 6.1 4 9" />
    </svg>
  )
}

/** External link (box with corner arrow). */
export function IconExternalLink({ className = 'ui-icon', size = defaultSize }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  )
}

export function IconPencil({ className = 'ui-icon', size = defaultSize }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function IconTrash({ className = 'ui-icon', size = defaultSize }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

/** Tab: cellar / grape bunch (tilted ~45°). */
export function IconGrapes({ className = 'ui-icon', size = defaultSize }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <g transform="rotate(45 12 12)">
        <path d="M12 3.75v5.25" />
        <path d="M12 5.1 10.6 3.9" />
        <path d="M12 8.25 7.75 5.65 7.05 9.55 10.65 10.65 12 8.25" />
        <path d="M12 8.25 16.25 5.65 16.95 9.55 13.35 10.65 12 8.25" />
        <circle cx="12" cy="11.15" r="1.48" />
        <circle cx="10.05" cy="12.55" r="1.48" />
        <circle cx="12" cy="12.55" r="1.48" />
        <circle cx="13.95" cy="12.55" r="1.48" />
        <circle cx="9.15" cy="14.55" r="1.48" />
        <circle cx="11.05" cy="14.55" r="1.48" />
        <circle cx="12.95" cy="14.55" r="1.48" />
        <circle cx="14.85" cy="14.55" r="1.48" />
        <circle cx="10.1" cy="16.55" r="1.48" />
        <circle cx="12" cy="16.55" r="1.48" />
        <circle cx="13.9" cy="16.55" r="1.48" />
        <circle cx="12" cy="18.45" r="1.48" />
        <path d="M15.35 16.45c1.35.55 2.15 1.75 1.85 3.15-.25 1.1-1.05 1.85-2.15 1.55" />
      </g>
    </svg>
  )
}

/** Tab: add (center FAB). */
export function IconPlus({ className = 'ui-icon', size = defaultSize }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

/** Tab: friends / social chat. */
export function IconChatBubble({ className = 'ui-icon', size = defaultSize }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  )
}

/** Tab: stats / insights. */
export function IconBarChart({ className = 'ui-icon', size = defaultSize }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-4" />
    </svg>
  )
}

/** Tab: profile / account. */
export function IconUser({ className = 'ui-icon', size = defaultSize }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  )
}

export function IconHeart({
  className = 'ui-icon',
  size = 16,
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}
