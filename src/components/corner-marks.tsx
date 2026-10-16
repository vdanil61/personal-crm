// Decorative "+" marks in the corners of the main button, as on the landing.
// The button needs `relative`.
const corners = ["-top-2.25 -left-1.25", "-top-2.25 -right-1.25", "-bottom-2.25 -left-1.25", "-bottom-2.25 -right-1.25"];

export function CornerMarks() {
  return corners.map((position) => (
    <span
      key={position}
      aria-hidden
      className={`pointer-events-none absolute font-corner text-corner text-primary ${position}`}
    >
      +
    </span>
  ));
}
