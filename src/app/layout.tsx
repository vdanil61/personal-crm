import type { Metadata } from "next";
import { Geologica } from "next/font/google";
import Link from "next/link";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Same font as on the landing
const geologica = Geologica({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Личная CRM",
  description: "Контакты людей, которых я знаю лично",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${geologica.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header>
          <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-5 lg:h-20">
            <Link href="/" className="flex items-center gap-2 text-logo lg:gap-2.5 lg:text-logo-lg">
              <span aria-hidden className="size-4.5 bg-primary lg:size-5.5" />
              Личная CRM
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-4 pb-16 lg:pt-8">{children}</main>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
