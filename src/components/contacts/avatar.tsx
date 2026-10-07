import { cn } from "@/lib/utils";

const palette = [
  "bg-sky-100 text-sky-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
  "bg-teal-100 text-teal-800",
  "bg-orange-100 text-orange-800",
  "bg-indigo-100 text-indigo-800",
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word[0]);
  return letters.join("").toLocaleUpperCase("ru") || "?";
}

// Same contact always gets the same color
function colorFor(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return palette[hash % palette.length];
}

export function ContactAvatar({ id, name, className }: { id: string; name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        colorFor(id),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
