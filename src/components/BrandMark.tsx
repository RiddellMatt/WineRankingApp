import { DECANTI_GLASS_SRC } from '../lib/brandAssets'

interface Props {
  className?: string
  size?: number
}

/** Decanti wine glass mark (matches the wordmark icon). */
export function BrandMark({ className = '', size = 40 }: Props) {
  return (
    <img
      src={DECANTI_GLASS_SRC}
      alt=""
      className={`brand-mark ${className}`.trim()}
      width={size}
      height={size}
      decoding="async"
      aria-hidden
    />
  )
}
