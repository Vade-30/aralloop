// Motion used only on the first screen. The keyframes live here because
// globals.css is shared with every other screen. People who ask for less
// motion get none: globals.css cuts every animation short.

// loop-flow: the dot that travels along the line behind the loop's steps. It
//   moves by `left`, not by a transform on a full-width wrapper, because a
//   shifted wrapper would stick out of the card and let the page scroll sideways.
// loop-step: a step's tile hops as the dot passes it. It animates `translate`
//   and `scale`, so it does not fight a tile's own rotation or ring.
// home-bob: the slow float of the cards in the picture on the blue band.
const KEYFRAMES = `
@keyframes loop-flow {
  0% { left: 0%; opacity: 0; }
  6%, 94% { opacity: 1; }
  100% { left: 100%; opacity: 0; }
}
@keyframes loop-step {
  0%, 12%, 100% { translate: 0 0; scale: 1; }
  4% { translate: 0 -5px; scale: 1.1; }
}
@keyframes home-bob {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -6px; }
}`;

/** How long the dot takes to cross the strip, and so how often each tile hops. */
export const LOOP_SECONDS = 8;

export function HomeMotion() {
  return <style>{KEYFRAMES}</style>;
}
