import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { requiredSetting } from "@/lib/env";

// Where emails go is a setting, not code: Mailpit on the owner's computer and in tests,
// Resend on the server. Both are plain SMTP, so this is the same code everywhere.
let cached: { url: string; transport: Transporter } | undefined;

function getTransport(): Transporter {
  const url = requiredSetting("SMTP_URL");
  if (cached?.url !== url) {
    cached = { url, transport: nodemailer.createTransport({ url, connectionTimeout: 10_000, socketTimeout: 20_000 }) };
  }
  return cached.transport;
}

export type Mail = { to: string; subject: string; text: string; html: string };

export async function sendMail(mail: Mail) {
  await getTransport().sendMail({ from: requiredSetting("MAIL_FROM"), ...mail });
}
