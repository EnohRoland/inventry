# Verification record

Validated in the development workspace on September 14, 2026.

| Check | Result |
| --- | --- |
| Frontend and backend production builds | Passed |
| Password hashing, stock arithmetic, transfer validation, order-line validation | 4 unit tests passed |
| Actual migration runner, including repeated application | Passed against ephemeral PGlite PostgreSQL |
| API workflows | 9 integration scenarios passed, plus suite/migration assertions |
| Browser workflow in local Chrome | Passed: sign in, create item, receive stock, create/submit/receive order, verify balance |
| Mobile browser layout at 390px width | Passed; no document overflow |
| Website branding and language selection | Passed in Chrome: local logo loads; English/French/Spanish switching; translated login errors and forms; persistence across reload and sign-out; canonical stock movement values; French mobile layout |
| Terraform main infrastructure | Initialized and validated successfully with provider lock file |
| Terraform state-bucket bootstrap | Initialized and validated successfully with provider lock file |
| Terraform formatting | Passed |
| Helm chart | Lint and template rendering passed |
| Docker Compose configuration | Parsed successfully using the example environment |
| Dependency installation audit | Reported zero known vulnerabilities at installation |

The API scenarios cover authentication, Origin checks, role restrictions, duplicate SKUs, stock receipts/issues/adjustments/transfers, overdraft rejection, transaction rollback, purchase-order transitions and repeated receiving, audit records, deactivation, and password/logout session revocation.

Local integration testing uses an embedded PostgreSQL engine with serialized connections. GitHub CI is configured to rerun the suite against PostgreSQL 17 with multiple connections; that external CI run has not happened yet. Local tests do not establish distributed concurrency performance or production capacity.

Docker images were not built or started locally because the Docker engine was unavailable. Container build/scanning jobs are included in CI. The Compose configuration check emitted a local Docker config-file permission warning but returned success.

No AWS account plan/apply, live EKS deployment, live RDS connection, DNS/TLS setup, controller installation, backup restoration, production smoke test, or GitHub Actions execution has been performed. Terraform validation and Helm rendering check configuration structure, not successful provisioning in a specific AWS account.

Browser screenshots are generated under `.local/screenshots/` (ignored by Git). See `README.md` and `docs/DEPLOYMENT.md` for run and deployment instructions.
