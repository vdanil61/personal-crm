import type { Metadata } from "next";
import Link from "next/link";

import { CornerMarks } from "@/components/corner-marks";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Ссылка устарела — Личная CRM" };

// Where every link that does not work leads: expired, already used, replaced by a newer one, or broken
export default function ExpiredLinkPage() {
  return (
    <>
      <h1 className="mb-6 text-page-title lg:mb-8 lg:text-page-title-lg">Ссылка устарела, запросите новую</h1>
      <Link href="/login" className={buttonVariants({ size: "lg", className: "relative w-full sm:w-auto" })}>
        Получить новую ссылку
        <CornerMarks />
      </Link>
    </>
  );
}
