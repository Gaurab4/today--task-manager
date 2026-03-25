type Props = {
  /** Bob gently when the sheet is ready for input */
  idle?: boolean
}

export function PersonFigure({ idle }: Props) {
  return (
    <svg
      className={`person-figure${idle ? ' person-figure--idle' : ''}`}
      viewBox="0 0 120 140"
      width="120"
      height="140"
      aria-hidden
    >
      <ellipse cx="60" cy="28" rx="22" ry="24" fill="currentColor" opacity="0.92" />
      <path
        d="M60 52c-18 0-32 14-34 32v48h68V84c-2-18-16-32-34-32z"
        fill="currentColor"
        opacity="0.88"
      />
      <path
        d="M22 68c-8 4-12 14-10 24l8 36"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <path
        d="M98 68c8 4 12 14 10 24l-8 36"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <path
        className="person-figure__arm person-figure__arm--l"
        d="M28 78 Q8 72 4 58"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <path
        className="person-figure__arm person-figure__arm--r"
        d="M92 78 Q112 72 116 58"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <circle className="person-figure__eye" cx="52" cy="26" r="3" />
      <circle className="person-figure__eye" cx="68" cy="26" r="3" />
      <path
        className="person-figure__smile"
        d="M52 38 Q60 44 68 38"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
    </svg>
  )
}
