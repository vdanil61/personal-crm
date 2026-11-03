import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

const EMAIL_LIMIT = 3;
const EMAIL_WINDOW_MINUTES = 10;
const IP_LIMIT = 10;
const IP_WINDOW_MINUTES = 60;
const KEEP_REQUESTS_DAYS = 1;

// The visitor's address on the internet. nginx puts it in X-Real-IP and overwrites whatever came from
// outside, so it cannot be forged; the other sources are for runs without nginx (local, tests).
export function readVisitorIp(headers: Headers | undefined): string {
  const ip = headers?.get("x-real-ip") ?? headers?.get("x-forwarded-for")?.split(",")[0] ?? "";
  return ip.trim().slice(0, 64) || "unknown";
}

// Counts a request for a login link and says whether it may go on: at most 3 per email in 10 minutes
// and 10 per address on the internet in 60 minutes, counted in a sliding window.
// A refused request is not written down, so refusals do not count. An allowed one is written down before
// the email is sent: a failed send counts too. It also cancels the links sent to this email before.
// One lock for everyone, so two requests at the same moment cannot both slip under the limit.
export async function registerLoginLinkRequest(email: string, ip: string): Promise<"allowed" | "too-many"> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('login_link_requests'))`);

    const counted = await tx.execute<{ by_email: number; by_ip: number }>(sql`
      select
        count(*) filter (where email = ${email} and created_at > now() - make_interval(mins => ${EMAIL_WINDOW_MINUTES}))::int as by_email,
        count(*) filter (where ip = ${ip})::int as by_ip
      from login_link_requests
      where created_at > now() - make_interval(mins => ${IP_WINDOW_MINUTES})
    `);
    const { by_email, by_ip } = counted.rows[0];
    if (by_email >= EMAIL_LIMIT || by_ip >= IP_LIMIT) return "too-many";

    await tx.execute(sql`insert into login_link_requests (email, ip) values (${email}, ${ip})`);
    await tx.execute(
      sql`delete from login_link_requests where created_at < now() - make_interval(days => ${KEEP_REQUESTS_DAYS})`,
    );
    // A new link cancels the old ones: the link is stored as a fingerprint, the email is in the value next to it
    await tx.execute(sql`
      delete from verifications
      where identifier like 'magic-link:%'
        and (case when identifier like 'magic-link:%' then value::jsonb ->> 'email' end) = ${email}
    `);
    return "allowed";
  });
}
