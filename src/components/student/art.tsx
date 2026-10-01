// Small drawings for the student screens' empty states, shown through the
// kit's EmptyState. They are simple shapes in the app's colours, drawn inline
// so nothing is downloaded, and they are decoration only: the text beside
// them says everything.

import { cn } from "@/components/ui";

const ART_CLASS = "h-28 w-auto";

/** A clipboard and a pencil: nothing has been handed out yet. */
export function ClipboardArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" fill="none" aria-hidden="true" className={cn(ART_CLASS, className)}>
      <circle cx="80" cy="64" r="52" fill="#eef4ff" />
      <circle cx="132" cy="24" r="9" fill="#f7c948" />
      <circle cx="24" cy="92" r="5" fill="#bfd3fe" />
      <rect x="50" y="24" width="60" height="80" rx="11" fill="#fff" stroke="#bfd3fe" strokeWidth="3" />
      <rect x="66" y="16" width="28" height="16" rx="7" fill="#2549e6" />
      <rect x="62" y="46" width="8" height="8" rx="3" fill="#f7c948" />
      <rect x="76" y="47" width="24" height="6" rx="3" fill="#dbe7fe" />
      <rect x="62" y="62" width="8" height="8" rx="3" fill="#dbe7fe" />
      <rect x="76" y="63" width="18" height="6" rx="3" fill="#dbe7fe" />
      <rect x="62" y="78" width="8" height="8" rx="3" fill="#dbe7fe" />
      <rect x="76" y="79" width="22" height="6" rx="3" fill="#dbe7fe" />
      <g transform="rotate(35 122 78)">
        <rect x="117" y="52" width="10" height="40" rx="3" fill="#2549e6" />
        <path d="M117 92h10l-5 9z" fill="#f7c948" />
      </g>
    </svg>
  );
}

/** A star with a check mark: everything is answered. */
export function StarArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" fill="none" aria-hidden="true" className={cn(ART_CLASS, className)}>
      <circle cx="80" cy="62" r="52" fill="#eef4ff" />
      <polygon
        points="80,28 87.6,47.5 108.5,48.7 92.4,62 97.6,82.3 80,71 62.4,82.3 67.6,62 51.5,48.7 72.4,47.5"
        fill="#f7c948"
        stroke="#f7c948"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <circle cx="112" cy="88" r="15" fill="#2549e6" stroke="#fff" strokeWidth="4" />
      <path
        d="M105 88l5 5 9-10"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="36" r="6" fill="#bfd3fe" />
      <circle cx="134" cy="30" r="4" fill="#2549e6" />
      <circle cx="38" cy="96" r="4" fill="#f7c948" />
    </svg>
  );
}

/** A score ring that has only just started: no results yet. */
export function RingArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" fill="none" aria-hidden="true" className={cn(ART_CLASS, className)}>
      <circle cx="80" cy="62" r="52" fill="#eef4ff" />
      <circle cx="80" cy="62" r="28" fill="#fff" stroke="#bfd3fe" strokeWidth="10" />
      <path d="M80 34a28 28 0 0 1 24.2 14" stroke="#f7c948" strokeWidth="10" strokeLinecap="round" />
      <rect x="68" y="58" width="24" height="8" rx="4" fill="#dbe7fe" />
      <circle cx="128" cy="92" r="7" fill="#2549e6" />
      <circle cx="30" cy="30" r="5" fill="#f7c948" />
    </svg>
  );
}

