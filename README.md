# Goshenignite Inventory

A three-tier inventory application for Goshenignite's mental health business: React frontend, Node.js API, and PostgreSQL. The AWS deployment targets **us-east-1**, with frontend and API on EKS and the database on managed RDS.

This first version manages general supplies and equipment. It includes usable inventory and purchasing workflows; it is not a patient-record or medication-dispensing system.

## Included workflows

- Dashboard: catalog size, stock value, low-stock items, open orders, and recent activity.
- Item catalog: create/edit items, categories, units, costs, search, low-stock filtering, CSV export.
- Stock by location: receipts, issues, signed adjustments, and atomic transfers.
- Purchasing: multiple order lines; draft → ordered → received, or cancellation. Repeated receipt requests do not add stock twice.
- Locations and suppliers: create and list records.
- Staff access: administrator, manager, staff, viewer; account creation, deactivation, password changes, and revocable sessions.
- Audit trail: actor, timestamp, action, and change details. Recent movement, order, and audit views show the latest 200 records.
- Goshen Ignite's official website logo on the sign-in screen and sidebar.
- English, French, and Spanish interface selection on the sign-in screen and workspace header. The browser remembers the selection, including after sign-out; dates and USD currency formatting follow the selected language. Catalog entries and other business records remain as entered.

Interface translations live in `frontend/src/translations.ts`, with language selection and formatting helpers in `frontend/src/i18n.ts`. Logo provenance is recorded in `frontend/public/branding/README.md`. No external translation service or website connection is needed at runtime.

## Run locally with Docker

Prerequisites: Docker Desktop with its Linux-container engine running.

```powershell
Copy-Item .env.example .env
# Edit .env: set SEED_ADMIN_EMAIL and a unique SEED_ADMIN_PASSWORD (14+ characters).
docker compose up --build -d
docker compose run --rm seed
```

Open **http://localhost:8080** and sign in using the administrator credentials you configured. There is no built-in production password. Add a location and items, then record a receipt to initialize stock.

For sample inventory, use the following **instead of the first seed command**, on an empty development database:

```powershell
docker compose run --rm -e SEED_DEMO=true seed
```

Seeding only initializes an empty users table. It never resets an existing administrator password or adds demo records to an initialized installation. `docker compose down` stops the app and keeps its named database volume. Do not use `down -v` unless you intend to erase local data.

## Develop without rebuilding images

Node.js 22.14+ and PostgreSQL 17 are required. A Docker database is convenient, but an existing local PostgreSQL server works too.

```powershell
Copy-Item .env.example .env
# Edit DATABASE_URL and administrator credentials.
npm.cmd ci
docker compose up -d database
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev:api
# In a second terminal:
npm.cmd run dev:web
```

The Vite frontend runs at `http://localhost:8080` and proxies `/api` to port 3000. The API accepts browser mutations only from `APP_ORIGIN`; keep that setting aligned with the URL you use.

## Verify

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run test:integration
npx.cmd playwright install chromium
npm.cmd run test:e2e
terraform -chdir=infra/terraform init -backend=false
terraform -chdir=infra/terraform validate
helm lint deploy/chart --set ingress.certificateArn=arn:aws:acm:us-east-1:123456789012:certificate/test
```

Integration tests use an ephemeral PGlite PostgreSQL engine if `DATABASE_URL` is absent. Set `DATABASE_URL` to a **test database** to run against a PostgreSQL server; the suite creates and deletes a uniquely named schema. CI uses PostgreSQL 17 and therefore tests actual multi-connection locking. Browser tests use their own ephemeral SQL database and require free ports 3000 and 8080; their sample credentials apply only to that test process.

## Repository guide

| Path | Contents |
| --- | --- |
| `frontend/` | React application, responsive styles, Nginx configuration, Dockerfile |
| `backend/` | Express API, SQL migration, seed/setup utilities, tests, Dockerfile |
| `compose.yaml` | Local frontend, API, PostgreSQL, migration, and seed services |
| `infra/bootstrap/` | Encrypted, versioned S3 Terraform state bucket |
| `infra/terraform/` | VPC, private subnets, EKS, ECR, RDS, IAM/OIDC, Secrets Manager, database alarm |
| `deploy/chart/` | Helm chart, migration job, probes, HPA, disruption budgets, network policies, TLS ingress |
| `deploy/platform.yaml` | Namespace, deployer RBAC, external database secret |
| `.github/workflows/` | CI validation and manually triggered build/scan/publish/deploy pipeline |
| `scripts/` | Cluster bootstrap, operator jobs, release deployment |
| `docs/` | Architecture, API reference, AWS deployment, operational notes |

New to this project? Start with [docs/OVERVIEW.md](docs/OVERVIEW.md) for a plain-English, diagram-led tour of how the app fits together and what's been built so far. Start with [the AWS deployment guide](docs/DEPLOYMENT.md) before provisioning. It explains the account, repository, domain/certificate, and private deployment runner inputs. No AWS resources are created by cloning or building this project.

## Current boundaries

Reorder points apply to aggregate stock across locations. Costs use a catalog unit cost for dashboard valuation; this is not FIFO accounting. Orders are received in full and record supplier orders placed outside the app. Locations and suppliers can be added, but do not yet have edit/archive screens. Equipment is tracked by quantity, not serial number. Medication lots, expiry dates, controlled-substance workflows, barcode scanning, email notifications, SSO/MFA, purchase approvals, partial receipts, and patient data are not implemented.

Review [operations and security](docs/OPERATIONS.md) before business use. The infrastructure includes useful safeguards but has not, by itself, established regulatory compliance or a completed production deployment.
