// Top-level overlays — actor detail, movie detail, end-of-round reveal.
// Must remain DOM siblings of <main>, never nested inside a section
// (sections create stacking contexts that trap z-index).
//
// STUB — implementation deferred.

export function openActorOverlay(/* personId */) {
  // TODO
}

export function openMovieOverlay(/* movieId */) {
  // TODO
}

export function openRevealOverlay(/* round */) {
  // TODO: animate chain reveal, post score to scoreboard, dismiss to home.
}
