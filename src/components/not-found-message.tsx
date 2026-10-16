import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NotFoundMessage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center gap-3 bg-card px-6 py-16 text-center">
      <h1 className="text-title">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Возможно, ссылка неполная или с ошибкой. Найдите человека в общем списке.
      </p>
      <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
        Ко всем контактам
      </Link>
    </div>
  );
}
