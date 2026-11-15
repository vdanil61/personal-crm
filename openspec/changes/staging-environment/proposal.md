## Why

Changes need a password-protected environment with a copy of production data before the owner checks them by hand.

## What Changes

- Add https://test-app.percrm.ru with its own database, secrets, container memory limits, HTTP password and TLS certificate.
- Deploy the same commit image independently to prod and staging after a merge to main, using one environment-aware script and Compose file.
- Serialize operations within each environment and preserve staging data between deploys.
- Document owner-run initialization and refresh from a production backup, environment-specific login and manual checks.

## Out of Scope

- Changing production to manual deployment or making it depend on staging. The owner's current request overrides that part of AGENTS.md.
- Adding tests, dependencies, services, database migrations, scheduled backups or registry retention changes.
- Reading or writing real .env files, entering passwords, changing DNS, running production deployments or restoring databases as the agent.

## Capabilities

### New Capabilities

- `staging-environment`: isolated, protected staging deployment and owner-run production data copy.

### Modified Capabilities

None. Existing login behavior already supports environment-specific addresses and host-only cookies.

## Impact

Deployment scripts, server Compose, nginx configuration, GitHub deployment workflow and README. Application authentication already uses BETTER_AUTH_URL and host-only cookies.
