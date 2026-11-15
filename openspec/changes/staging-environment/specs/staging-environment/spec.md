## ADDED Requirements

### Requirement: Isolated staging environment
Staging SHALL use its own Compose project, database volume, .env, authentication secret and SMTP key. Its app and tool containers MUST be limited to 384 MiB and its database to 256 MiB.

#### Scenario: Inspect isolation
- **WHEN** the owner inspects prod and staging containers and creates a contact on staging
- **THEN** the projects, volumes and ports differ, memory limits are present on staging, and the contact does not appear in production

### Requirement: Production data copy
The owner SHALL initialize or refresh staging with restore.sh staging from a completed production backup. The command MUST show the source and destination, require yes and save the previous database. Ordinary deploys MUST retain staging data and MUST NOT create backups.

#### Scenario: Initialize and deploy twice
- **WHEN** the owner initializes staging from a production backup and staging is deployed twice
- **THEN** the owner's copied contacts are visible and a new staging contact survives both deployments without changing production

### Requirement: Login stays within its environment
Login emails SHALL link to the environment where login was requested. Login cookies MUST have no Domain attribute.

#### Scenario: Compare logins
- **WHEN** the owner requests and follows login emails in both environments and inspects the browser cookies
- **THEN** each link uses its own hostname, cookies have no shared domain, and logout on staging does not log out production

### Requirement: Password and HTTPS
The staging hostname SHALL have a valid TLS certificate and require a password for all application routes.

#### Scenario: Open a private browser window
- **WHEN** the owner opens staging, its login API and /health without Basic Auth credentials
- **THEN** HTTPS has a valid certificate and every route returns a password challenge; correct credentials allow access

### Requirement: Independent serialized deployment
Every merge to main SHALL build one SHA-tagged image and independently deploy it to prod and staging through the same environment-aware script. Operations on one environment MUST NOT overlap. A staging failure MUST NOT block production.

#### Scenario: Observe concurrent runs
- **WHEN** two main merges trigger deployments and staging is unavailable
- **THEN** staging jobs wait for their environment, production can still deploy, and the server rejects another operation on a locked environment

### Requirement: Manual failure recovery
Failed migrations or smoke checks SHALL stop deployment with an error and MUST NOT trigger rollback. Staging's current image MUST be protected from production image cleanup.

#### Scenario: Inspect a failed deployment
- **WHEN** a staging deployment fails
- **THEN** GitHub reports the failed step, production runs independently, and the owner can inspect journald logs and choose a manual rollback
