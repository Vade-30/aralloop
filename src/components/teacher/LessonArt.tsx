// Small decorative drawings for the teacher screens, made of plain shapes in
// the app's own colours. They carry no meaning, so each one is hidden from
// screen readers; the text beside it says everything.

import type { ReactNode } from "react";
import { cn } from "@/components/ui";

// SVG cannot read Tailwind tokens in attributes, so the palette is repeated.
const BLUE = "#2549e6";
const BLUE_EDGE = "#162a94";
const BLUE_200 = "#bfd3fe";
const BLUE_100 = "#dbe7fe";
const BLUE_50 = "#eef4ff";
const YELLOW = "#f7c948";
const YELLOW_EDGE = "#c99a12";
const INK = "#16204a";

interface ArtProps {
  className?: string;
}

function Art({
  viewBox,
  className,
  children,
}: ArtProps & { viewBox: string; children: ReactNode }) {
  return (
    <svg viewBox={viewBox} fill="none" aria-hidden="true" className={cn("flex-none", className)}>
      {children}
    </svg>
  );
}

/** A sheet of paper standing on its raised edge, with a few lines of text. */
function Sheet() {
  return (
    <>
      <rect x="62" y="30" width="78" height="96" rx="13" fill={BLUE_200} />
      <rect x="62" y="24" width="78" height="96" rx="13" fill="#fff" stroke={BLUE_200} strokeWidth="3" />
      <rect x="75" y="41" width="38" height="9" rx="4.5" fill={BLUE} />
      <rect x="75" y="60" width="52" height="6" rx="3" fill={BLUE_100} />
      <rect x="75" y="74" width="52" height="6" rx="3" fill={BLUE_100} />
      <rect x="75" y="88" width="34" height="6" rx="3" fill={BLUE_100} />
    </>
  );
}

/** Empty class: a first lesson waiting to be added. */
export function LessonStackArt({ className }: ArtProps) {
  return (
    <Art viewBox="0 0 200 140" className={className}>
      <circle cx="100" cy="74" r="60" fill={BLUE_50} />
      <circle cx="164" cy="30" r="9" fill={YELLOW} />
      <circle cx="30" cy="106" r="6" fill={BLUE_200} />
      <rect
        x="56"
        y="28"
        width="78"
        height="96"
        rx="13"
        fill={BLUE_100}
        transform="rotate(-9 95 76)"
      />
      <Sheet />
      <path d="M42 26l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill={YELLOW} />
      <circle cx="142" cy="113" r="19" fill={YELLOW_EDGE} />
      <circle cx="142" cy="108" r="19" fill={YELLOW} />
      <path d="M142 99v18M133 108h18" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
    </Art>
  );
}

/** New lesson: the lesson text on the left becomes an activity on the right. */
export function LessonFlowArt({ className }: ArtProps) {
  return (
    <Art viewBox="0 0 240 100" className={className}>
      <rect x="14" y="19" width="62" height="72" rx="12" fill={BLUE_200} />
      <rect x="14" y="13" width="62" height="72" rx="12" fill="#fff" stroke={BLUE_200} strokeWidth="3" />
      <rect x="25" y="27" width="28" height="7" rx="3.5" fill={BLUE} />
      <rect x="25" y="42" width="40" height="5" rx="2.5" fill={BLUE_100} />
      <rect x="25" y="53" width="40" height="5" rx="2.5" fill={BLUE_100} />
      <rect x="25" y="64" width="26" height="5" rx="2.5" fill={BLUE_100} />

      <path d="M92 49h40" stroke={BLUE} strokeWidth="4" strokeLinecap="round" strokeDasharray="1 10" />
      <path
        d="M134 40l10 9-10 9"
        stroke={BLUE}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <rect x="160" y="17" width="66" height="76" rx="13" fill={BLUE_EDGE} />
      <rect x="160" y="11" width="66" height="76" rx="13" fill={BLUE} />
      <circle cx="176" cy="30" r="6" fill={YELLOW} />
      <rect x="188" y="27" width="28" height="6" rx="3" fill="#fff" />
      <circle cx="176" cy="49" r="6" fill={YELLOW} />
      <rect x="188" y="46" width="22" height="6" rx="3" fill="#fff" />
      <circle cx="176" cy="68" r="6" fill="#fff" opacity="0.35" />
      <rect x="188" y="65" width="28" height="6" rx="3" fill="#fff" opacity="0.35" />
    </Art>
  );
}
