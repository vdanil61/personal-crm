// When a row disappears, the rows below move up at once, so the second click of a quick
// double click lands on the next row's button. Row buttons ignore clicks for a moment after that.
const SETTLE_MS = 600;

let movedAt = Number.NEGATIVE_INFINITY;

export function markRowsMoved() {
  movedAt = performance.now();
}

export function rowsJustMoved(): boolean {
  return performance.now() - movedAt < SETTLE_MS;
}
