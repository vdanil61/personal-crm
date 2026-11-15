## 1. Preparation

- [x] Inspect current deployment, authentication and server access without reading secrets.
- [x] Create a branch from updated main and preserve the owner's AGENTS.md changes.
- [x] Record scope, design and manual acceptance criteria; no new tests per owner request.

## 2. Implementation

- [x] Parameterize shared scripts and Compose, with separate locks, ports, limits and protected images.
- [x] Add independent staging deployment after the shared image build.
- [x] Add owner-run staging initialization/refresh through restore.
- [x] Add staging nginx and server setup with password protection and webroot TLS issuance.
- [x] Document configuration, manual checks, logs and rollback.

## 3. Verification and Server

- [x] Check shell syntax, ShellCheck, actionlint, formatting and Compose using synthetic settings only; validate OpenSpec artifacts.
- [x] Prepare the staging server folder and nginx, configure the HTTP password with the owner and issue TLS.
- [x] Configure staging .env with the owner and import a backup by owner-run restore.
- [x] Deploy staging, verify HTTPS/password/health and complete the owner-run redeployment after correcting the mail sender.
- [x] Owner confirms successful email login, manual staging actions and unaffected production data after a separate production login.
- [x] Fix the existing session-expiry e2e setup so background page prefetches cannot race with artificial session aging; retain both original expiry assertions. Baseline failed 2 of 12 repeated runs; corrected setup passed 24 of 24 on isolated Docker Postgres and Mailpit.
- [ ] Verify a contact created on staging survives the next deployment and observe independent GitHub deployment jobs after merge.
- [ ] Complete PR and CI when the owner requests commit and push; no production deploy by the agent.

The owner configured staging .env and successfully ran restore.sh staging 2026-11-03_225056_74e6bac.dump. The database copy loaded and migrations reported 0 newly applied and 7 total. The staging nginx site is enabled; nginx and snap.certbot.renew.timer are active. HTTPS with certificate validation returns 401 Basic Auth for both /health and /api/auth/get-session. Both environments' local /health endpoints return HTTP 200.

The initial mail failure logged EMESSAGE. Owner-run Resend diagnosis returned HTTP 403: the staging key was not authorized for mail.percrm.ru. The owner identified the key's allowed domain as mail.crm.percrm.ru, changed staging MAIL_FROM accordingly and redeployed the existing image. The owner then confirmed successful email login and manual actions on staging, followed by a separate production login with no production data affected. README now uses the chosen staging sender domain. Real .env files have not been read or written by the agent. Automatic deployments remain unverified until this branch is merged through PR and CI.
