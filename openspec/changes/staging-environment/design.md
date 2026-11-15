## Context

Production uses Compose project prod in /home/deploy/personal-crm and localhost port 3000. GitHub builds one SHA-tagged image and deploys on main. Authentication already takes its base URL from the environment, and Better Auth does not set a cookie Domain by default.

## Decisions

- Keep production paths, port, automatic trigger and legacy deploy.sh IMAGE [USER] invocation compatible.
- Add project staging in /home/deploy/personal-crm-staging on localhost port 3001. Export staging's fixed URL, 384 MiB app/tool limit and 256 MiB database limit from the shared script; disable additional swap above these limits.
- Use separate named database volumes, .env files, signing secrets and SMTP keys. Compose passes only explicitly listed settings; no other external integrations exist in the current app.
- The staging sender uses mail.crm.percrm.ru, matching the domain allowed by the owner's staging Resend key. The login base URL remains https://test-app.percrm.ru.
- Use separate GitHub concurrency groups and per-directory flock locks. Lock copying scripts as well as deployment. Never cancel a running deploy.
- Import production backups only through owner-run restore.sh staging BACKUP. Require confirmation and save the previous staging database. First staging deployment refuses to start without initialization. Later deployments preserve data. Production restore retains its existing behavior.
- Use journald for container logs. Limit cleanup to production; retain staging's current image and skip cleanup if staging is busy. Preserve images younger than two weeks as well as the current and previous production releases.
- Install only the new nginx virtual host. HTTP serves ACME and redirects to HTTPS. HTTPS requires Basic Auth for every application route, including health. Use certbot webroot so it does not rewrite other virtual hosts.
- Prepare setup scripts for a human terminal because sudo, Basic Auth password and real .env configuration belong to the owner under AGENTS.md. Certificate issuance can then run without revealing private keys.

## Data Model

No schema change or migration. Restoring staging changes only staging data and requires the owner's explicit confirmation. Production data is read from a completed backup file; staging never connects to the production database.

## Rollback

No automatic rollback. A human can invoke rollback.sh staging to return the previous staging image. Its data and migrations remain; database refresh uses restore.sh staging. Production rollback remains unchanged.
