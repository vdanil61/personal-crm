import { cn } from "@/lib/utils";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word[0]);
  return letters.join("").toLocaleUpperCase("ru") || "?";
}

// Accent square with initials, as on the landing's contact card
export function ContactAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center bg-primary text-sm font-medium text-primary-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
