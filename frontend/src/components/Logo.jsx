// Logo component
// variant="dark"  → black background, white mark  (use on light page backgrounds)
// variant="light" → white background, black mark  (use on dark sidebar)
// showBg=false    → transparent, mark only (use as inline icon)
export default function Logo({ variant = 'dark', size = 28, showBg = true }) {
  const bgColor   = variant === 'light' ? '#ffffff' : '#0a0a0a'
  const markColor = variant === 'light' ? '#0a0a0a' : '#ffffff'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {showBg && <rect width="100" height="100" rx="20" fill={bgColor} />}

      {/* Back loop — upper-left */}
      <rect
        x="10" y="14"
        width="55" height="42"
        rx="13"
        stroke={markColor}
        strokeWidth="9"
        fill="none"
      />

      {/* Interleave trick: cover the right edge of the back loop so the
          front loop appears to weave over it at the top crossing point */}
      {showBg && (
        <rect
          x="55" y="24"
          width="11" height="22"
          fill={bgColor}
        />
      )}

      {/* Front loop — lower-right */}
      <rect
        x="35" y="44"
        width="55" height="42"
        rx="13"
        stroke={markColor}
        strokeWidth="9"
        fill="none"
      />
    </svg>
  )
}
