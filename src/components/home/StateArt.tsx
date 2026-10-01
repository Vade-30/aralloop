// Small pictures for the "not found" and "could not load" screens, built from
// plain elements in the app's colours, so they need no image files. They are
// decoration: the words beside them say what happened.

import type { ReactNode } from "react";
import { cn } from "@/components/ui";

// The keyframes live here because globals.css is shared. People who ask for
// less motion get none: globals.css cuts every animation short.
const KEYFRAMES = `
@keyframes state-float {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -7px; }
}
@keyframes state-sway {
  0%, 100% { rotate: -8deg; }
  50% { rotate: -2deg; }
}`;

/** `seconds` is how far into the float a shape starts, so they do not move together. */
function float(seconds: number) {
  return { animation: `state-float 5s ease-in-out -${seconds}s infinite` };
}

/** The loose shapes that drift around both pictures. */
function Confetti() {
  return (
    <>
      <span
        className="absolute right-3 top-1 h-7 w-7 rounded-full bg-accent-400"
        style={float(0)}
      />
      <span
        className="absolute bottom-5 left-1 h-4 w-4 rounded-full bg-brand-300"
        style={float(1.5)}
      />
      <span
        className="absolute left-7 top-3 h-3.5 w-3.5 rotate-12 rounded-[5px] bg-brand-600"
        style={float(3)}
      />
      <span
        className="absolute bottom-1 right-6 h-3 w-9 -rotate-12 rounded-full bg-accent-200"
        style={float(2.2)}
      />
    </>
  );
}

const TILE_TONES = {
  brand: "bg-brand-600 text-white shadow-edge-brand",
  danger: "bg-red-600 text-white shadow-edge-danger",
};

/** A big tilted icon tile on a soft circle, inside a slowly turning dashed ring. */
export function StateArt({
  children,
  tone = "brand",
  className,
}: {
  /** One lucide icon. */
  children: ReactNode;
  tone?: keyof typeof TILE_TONES;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("relative mx-auto h-40 w-56", className)}>
      <style>{KEYFRAMES}</style>
      <span className="absolute left-1/2 top-1/2 -ml-[4.75rem] -mt-[4.75rem] h-[9.5rem] w-[9.5rem] animate-[spin_30s_linear_infinite] rounded-full border-2 border-dashed border-brand-200" />
      <span className="absolute left-1/2 top-1/2 -ml-16 -mt-16 h-32 w-32 rounded-full bg-brand-100" />
      <Confetti />
      <span className="absolute left-1/2 top-1/2 -ml-11 -mt-11 block animate-pop">
        <span
          className={cn(
            "flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-[1.75rem] [&>svg]:h-11 [&>svg]:w-11",
            TILE_TONES[tone],
          )}
          style={{ animation: "state-sway 4s ease-in-out infinite" }}
        >
          {children}
        </span>
      </span>
    </div>
  );
}

// Chunky numerals standing on their own hard shadow, like the kit's buttons.
const DIGIT =
  "font-display text-[6.5rem] font-extrabold leading-none text-brand-600 [text-shadow:0_6px_0_var(--color-brand-200)]";

/** "404" with the zero as a yellow disc that holds an icon. */
export function LostArt({
  children,
  className,
}: {
  /** One lucide icon, shown in place of the zero. */
  children: ReactNode;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("relative mx-auto h-40 w-64", className)}>
      <style>{KEYFRAMES}</style>
      <Confetti />
      <div className="absolute inset-0 flex items-center justify-center gap-2.5">
        <span className={cn(DIGIT, "-rotate-6 animate-pop")}>4</span>
        <span className="block animate-pop" style={{ animationDelay: "120ms" }}>
          <span
            className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-400 text-ink shadow-[0_6px_0_var(--color-accent-600)] [&>svg]:h-11 [&>svg]:w-11"
            style={float(1)}
          >
            {children}
          </span>
        </span>
        <span className={cn(DIGIT, "rotate-6 animate-pop")} style={{ animationDelay: "240ms" }}>
          4
        </span>
      </div>
    </div>
  );
}
