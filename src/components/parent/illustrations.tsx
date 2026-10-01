// Small drawings for the parent screens, made of plain shapes in the app's
// blue and yellow. They are decoration only, so screen readers skip them.

/** A clipboard with a clock on it: nothing has come in yet. */
export function WaitingArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" className={className}>
      <circle cx="60" cy="62" r="46" fill="#eef4ff" />
      <circle cx="100" cy="24" r="8" fill="#f7c948" />
      <circle cx="18" cy="94" r="5" fill="#bfd3fe" />
      <rect x="34" y="28" width="52" height="66" rx="10" fill="#fff" stroke="#bfd3fe" strokeWidth="3" />
      <rect x="48" y="21" width="24" height="13" rx="6.5" fill="#2549e6" />
      <rect x="44" y="46" width="32" height="5" rx="2.5" fill="#dbe7fe" />
      <rect x="44" y="58" width="22" height="5" rx="2.5" fill="#dbe7fe" />
      <rect x="44" y="70" width="27" height="5" rx="2.5" fill="#dbe7fe" />
      <circle cx="85" cy="88" r="15" fill="#f7c948" stroke="#fff" strokeWidth="3" />
      <path
        d="M85 80v8l5 3"
        stroke="#16204a"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A parent and an empty place beside them: no student is linked. */
export function NoChildArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 124 96" fill="none" aria-hidden="true" className={className}>
      <circle cx="32" cy="48" r="27" fill="#2549e6" />
      <circle cx="32" cy="40" r="9" fill="#fff" />
      <path d="M16 64c2-9 9-13 16-13s14 4 16 13z" fill="#fff" />
      <path d="M61 48h4" stroke="#c99a12" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="0.1 7" />
      <circle
        cx="92"
        cy="48"
        r="25.5"
        fill="#fff"
        stroke="#f0b429"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="5 7"
      />
      <circle cx="92" cy="40" r="9" fill="#fce588" />
      <path d="M76 64c2-9 9-13 16-13s14 4 16 13z" fill="#fce588" />
    </svg>
  );
}

/** A house under the sun, tone on tone, for the corner of the home tip. */
export function HomeArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" fill="none" aria-hidden="true" className={className}>
      <circle cx="74" cy="20" r="11" fill="#f7c948" />
      <path d="M10 50 48 18l38 32v34a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6z" fill="#fadb5f" />
      <path
        d="M4 52 48 15l44 37"
        stroke="#f0b429"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="40" y="62" width="16" height="28" rx="4" fill="#fff3c4" />
      <rect x="20" y="56" width="12" height="12" rx="3" fill="#fff3c4" />
      <rect x="64" y="56" width="12" height="12" rx="3" fill="#fff3c4" />
    </svg>
  );
}
