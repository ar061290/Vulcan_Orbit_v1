// Ambient background. PHASE 1: a no-op. Phase 6 (P6-B) ports main's slow motes and clears the canvas when
// motion is Calm (main left the last frame on screen). The interface stays: startBackground(), stopBackground().
export function startBackground() { /* phase 6 */ }
export function stopBackground() { document.getElementById('bg')?.remove(); }
