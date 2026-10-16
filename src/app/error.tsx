"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 bg-card px-6 py-16 text-center">
      <h1 className="text-title">Не получилось загрузить данные</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Скорее всего, не запущена база данных. Проверьте, что Docker Desktop работает, и попробуйте ещё раз.
      </p>
      <Button variant="outline" onClick={() => retry()}>
        Попробовать ещё раз
      </Button>
    </div>
  );
}
