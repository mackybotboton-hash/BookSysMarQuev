export function PesoIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 4h6a4.5 4.5 0 0 1 0 9H6V4z" />
      <path d="M6 4v16" />
      <path d="M3.5 8h13" />
      <path d="M3.5 11h13" />
    </svg>
  )
}
