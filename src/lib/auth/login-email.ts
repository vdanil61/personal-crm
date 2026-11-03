import type { Mail } from "@/lib/mail";

const SUBJECT = "Вход в Личную CRM";
const LINK_LIFETIME_MINUTES = 15;
const IGNORE_NOTE = "Если вы не запрашивали вход — просто проигнорируйте письмо.";

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// The login email: a styled version and a plain one. Mail programs do not know our design tokens,
// so the colors of the app are written out in simple inline styles.
export function buildLoginEmail(to: string, link: string): Mail {
  const text = [
    "Вход в Личную CRM",
    "",
    `Откройте ссылку, чтобы войти. Она работает ${LINK_LIFETIME_MINUTES} минут и только один раз:`,
    link,
    "",
    IGNORE_NOTE,
  ].join("\n");

  const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:#eceef5;font-family:Geologica,Arial,sans-serif;color:#16182b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 24px;font-size:17px;font-weight:600;">
            <span style="display:inline-block;width:18px;height:18px;background:#4b4fe0;vertical-align:-2px;"></span>
            Личная CRM
          </p>
          <h1 style="margin:0 0 12px;font-size:26px;line-height:1.15;font-weight:500;">${SUBJECT}</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">
            Нажмите «Войти», чтобы открыть приложение. Ссылка работает ${LINK_LIFETIME_MINUTES} минут и только один раз.
          </p>
          <a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 32px;background:#4b4fe0;color:#ffffff;font-size:16px;font-weight:500;text-decoration:none;">Войти</a>
          <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e3e5ef;font-size:14px;line-height:1.5;color:#5d6077;">${IGNORE_NOTE}</p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

  return { to, subject: SUBJECT, text, html };
}
