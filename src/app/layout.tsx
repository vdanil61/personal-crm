import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { BookUserIcon } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Личная CRM",
  description: "Контакты людей, которых я знаю лично",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-neutral-50">
        <header className="border-b bg-background">
          <div className="mx-auto flex h-14 w-full max-w-3xl items-center px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <BookUserIcon className="size-5 text-primary" aria-hidden />
              Личная CRM
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
