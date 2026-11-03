import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Вход — Личная CRM" };

// Open without a login (src/proxy.ts sends a signed-in visitor to the main page)
export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-page-title lg:mb-8 lg:text-page-title-lg">Вход в Личную CRM</h1>
      <LoginForm />
    </>
  );
}
