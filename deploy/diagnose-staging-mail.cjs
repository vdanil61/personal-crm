// Human-run diagnosis inside staging-app-1. Sends one plain email to OWNER_EMAIL.
// Uses the container's existing settings; does not read .env or print credentials.
// Uses Resend's API with the same key and sender to obtain its detailed rejection reason.

const hidden = [process.env.SMTP_URL, process.env.BETTER_AUTH_SECRET, process.env.POSTGRES_PASSWORD].filter(Boolean);

function safe(value) {
  let result = String(value ?? "unavailable");
  for (const secret of hidden) result = result.split(secret).join("[redacted]");
  return result
    .replace(/re_[a-zA-Z0-9_-]+/g, "[redacted-key]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 1200);
}

async function main() {
  if (process.env.BETTER_AUTH_URL !== "https://test-app.percrm.ru") {
    throw new Error("Refusing diagnosis outside staging");
  }
  for (const key of ["SMTP_URL", "MAIL_FROM", "OWNER_EMAIL"]) {
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  }
  const url = new URL(process.env.SMTP_URL);
  if (url.password) hidden.push(url.password, decodeURIComponent(url.password));
  if (!/^smtps?:$/.test(url.protocol)) throw new Error("SMTP_URL must use smtp or smtps");
  if (url.hostname !== "smtp.resend.com" || decodeURIComponent(url.username) !== "resend") {
    throw new Error("This diagnostic requires a Resend SMTP_URL");
  }
  if (!url.password) throw new Error("SMTP_URL has no API key");
  if (!/^[^\s<>@,;]+@[^\s<>@,;]+$/.test(process.env.OWNER_EMAIL)) {
    throw new Error("OWNER_EMAIL must contain exactly one email address");
  }

  console.log("Sending one diagnostic email through Resend API to the configured OWNER_EMAIL...");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${decodeURIComponent(url.password)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [process.env.OWNER_EMAIL],
      subject: "Проверка почты тест-стенда Личной CRM",
      text: "Проверка отправки почты с test-app.percrm.ru. Это диагностическое письмо, ссылки для входа в нём нет.",
    }),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  const result = await response.json();
  console.log(`Resend HTTP status: ${response.status}`);
  if (response.ok) {
    console.log(
      "Diagnostic email accepted. If login emails still fail, investigate the SMTP-specific response or login message content.",
    );
  } else {
    console.log(`Resend error: ${safe(result.name)}`);
    console.log(`Resend message: ${safe(result.message)}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Code: ${safe(error.code)}`);
  console.error(`Message: ${safe(error.message)}`);
  process.exitCode = 1;
});
