# Deploy to AWS EKS in us-east-1

The repository prepares a production-shaped installation. Provisioning and deployment have not been performed. The commands below create billable resources when you run the Terraform apply steps.

## Inputs and prerequisites

- An AWS account and a platform administrator IAM role able to create the resources in `infra/terraform`.
- A GitHub repository using `main` as its release branch.
- A domain you control, such as `inventory.your-domain.com`.
- An issued ACM certificate for that host **in us-east-1**. DNS validation and the DNS record are intentionally outside this Terraform configuration because a domain/hosted zone has not been supplied.
- AWS CLI v2, Node.js 22, Docker, Terraform 1.11+, kubectl compatible with EKS 1.35, Helm 3, and Bash with `envsubst`. Use Linux/WSL for shell scripts.
- An administrator workstation with VPC access for a private Kubernetes API (VPN, SSM-connected operator host, or equivalent).
- A dedicated Linux GitHub deployment runner with private VPC connectivity, labels `self-hosted`, `linux`, `x64`, `goshenignite-deploy`, and AWS CLI, Helm, kubectl, Bash, and curl installed. Prefer an ephemeral runner. Runner infrastructure/registration is account-specific and is not provisioned here. PR jobs run on GitHub-hosted runners, never this trusted runner.

## 1. Create remote Terraform state

Choose a globally unique S3 bucket name. From the repository root:

```bash
terraform -chdir=infra/bootstrap init
terraform -chdir=infra/bootstrap plan -var='state_bucket_name=YOUR-UNIQUE-goshenignite-state' -out=bootstrap.tfplan
# Review the plan, then:
terraform -chdir=infra/bootstrap apply bootstrap.tfplan
```

Keep the bootstrap state securely; it starts as local state. The bucket has versioning, encryption, public-access blocking, a TLS-only policy, and Terraform destroy protection. Restrict access to operators and the infrastructure workflow identities you choose. The main stack state includes the generated application database password; it must be treated as a secret.

Copy `infra/terraform/backend.hcl.example` to a local file and set the bucket name. Copy `terraform.tfvars.example` to `infra/terraform/terraform.tfvars`, and replace the repository and administrator role placeholders. If GitHub's OIDC provider already exists in the AWS account, supply its ARN to avoid trying to create a duplicate.

```bash
terraform -chdir=infra/terraform init -backend-config=backend.hcl
terraform -chdir=infra/terraform plan -out=production.tfplan
# Review expected resources and costs before applying:
terraform -chdir=infra/terraform apply production.tfplan
terraform -chdir=infra/terraform output
```

The stack creates EKS 1.35, two managed worker nodes, two NAT gateways, a Multi-AZ RDS PostgreSQL instance, ECR repositories, Secrets Manager, IAM roles, an S3 gateway endpoint, and a database storage alarm/SNS topic. There is no automatic Terraform apply workflow.

The default EKS endpoint is private. `eks_public_access_cidrs` may contain a trusted administrator egress `/32` if needed; it never needs to be opened to the world for GitHub deployments. Private nodes retain access through the private endpoint. Check current regional EKS version availability before applying or upgrading.

## 2. Build and publish initial images

Run on a trusted workstation with Docker and AWS credentials authorized to push to these ECR repositories. Use values from `terraform output ecr_repositories`.

```bash
export AWS_REGION=us-east-1
export ECR_REGISTRY=123456789012.dkr.ecr.us-east-1.amazonaws.com
export BACKEND_REPOSITORY="$ECR_REGISTRY/goshenignite-production/backend"
export FRONTEND_REPOSITORY="$ECR_REGISTRY/goshenignite-production/frontend"
export IMAGE_TAG=initial-001
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
docker build -f backend/Dockerfile -t "$BACKEND_REPOSITORY:$IMAGE_TAG" .
docker build -f frontend/Dockerfile -t "$FRONTEND_REPOSITORY:$IMAGE_TAG" .
docker push "$BACKEND_REPOSITORY:$IMAGE_TAG"
docker push "$FRONTEND_REPOSITORY:$IMAGE_TAG"
```

Tags are immutable. Use a new tag for each build. CI also scans candidate images before publishing them; run an equivalent image scan for a manual initial build.

## 3. Bootstrap cluster controllers and secrets

Use the platform administrator role from the Terraform configuration and a machine that can reach the Kubernetes endpoint. Export Terraform outputs:

```bash
export CLUSTER_NAME=goshenignite-production
export VPC_ID=vpc-REPLACE
export EXTERNAL_SECRETS_ROLE_ARN=arn:aws:iam::123456789012:role/goshenignite-production-external-secrets
export LOAD_BALANCER_ROLE_ARN=arn:aws:iam::123456789012:role/goshenignite-production-load-balancer-controller
export APPLICATION_SECRET_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:REPLACE
bash scripts/bootstrap-cluster.sh
```

This installs pinned controller charts, creates the restricted `goshenignite` namespace and deployment RBAC, and waits for the database secret. Platform resources are installed separately so the application's pre-install migration job can read its secret on the very first install.

## 4. Create the database application role

RDS generates a managed administrator secret. Application pods use a separate `inventory_app` role. The operator must have `secretsmanager:GetSecretValue` for the RDS master secret, in addition to Kubernetes administrator access.

```bash
export BACKEND_IMAGE="$BACKEND_REPOSITORY:$IMAGE_TAG"
export DATABASE_MASTER_SECRET_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:REPLACE
node scripts/admin-job.mjs provision
```

The operator helper fetches the administrator credential without printing it, creates a short-lived Kubernetes secret and restricted setup job, waits for completion, and deletes the temporary credential secret. The job connects to RDS with certificate verification and grants only database connection and public-schema creation/use to the application role. It does not grant the RDS administrator role to the application.

The application role owns its tables and runs migrations in this first version. For higher assurance, separate migration ownership from runtime data privileges and ship audit events to independently controlled storage.

## 5. Install the application, DNS, and administrator

The first deployment must create the ALB before a DNS target exists. Run Helm directly for this initial install:

```bash
export APP_HOST=inventory.your-domain.com
export ACM_CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/REPLACE
helm upgrade --install inventory deploy/chart --namespace goshenignite --atomic --wait --timeout 10m \
  --set-string backend.repository="$BACKEND_REPOSITORY" --set-string frontend.repository="$FRONTEND_REPOSITORY" \
  --set-string backend.tag="$IMAGE_TAG" --set-string frontend.tag="$IMAGE_TAG" \
  --set-string appOrigin="https://$APP_HOST" --set-string ingress.host="$APP_HOST" \
  --set-string ingress.certificateArn="$ACM_CERTIFICATE_ARN"
kubectl -n goshenignite get ingress inventory
```

Point the hostname to the ALB's reported address with a Route 53 alias or your DNS provider's appropriate record. Wait for DNS, then check `https://$APP_HOST/api/health/ready`.

Create the first administrator without demo data. Read the password interactively so it is not typed into shell history:

```bash
export SEED_ADMIN_EMAIL=YOUR-ADMIN-EMAIL
read -rsp 'Initial admin password (14+ characters): ' SEED_ADMIN_PASSWORD
echo
export SEED_ADMIN_PASSWORD
node scripts/admin-job.mjs seed
unset SEED_ADMIN_PASSWORD
```

Sign in and add real locations, suppliers, items, and opening stock. Verify a receipt, issue, transfer, order receipt, and a viewer account before inviting the wider team.

## 6. Configure CI/CD

Set these GitHub **repository variables** from the Terraform outputs and your domain configuration:

| Variable | Value |
| --- | --- |
| `AWS_BUILD_ROLE_ARN` | `github_build_role_arn` output |
| `AWS_DEPLOY_ROLE_ARN` | `github_deploy_role_arn` output |
| `ECR_REGISTRY` | `ACCOUNT.dkr.ecr.us-east-1.amazonaws.com` |
| `APP_HOST` | Inventory hostname, without `https://` |
| `ACM_CERTIFICATE_ARN` | Issued certificate ARN in us-east-1 |

Create a GitHub environment named **production**, restrict it to `main`, and configure deployment reviewers according to your release process. Repository branch protection should require the Validate workflow. The build role trusts only this repository's `main` branch. The deployment role trusts only this repository's `production` environment.

The **Validate** workflow runs builds, unit/API tests with PostgreSQL, dependency auditing, Docker builds and image scanning, Terraform validation, and Helm lint/rendering on PRs and main pushes. The **Release** workflow is manually dispatched on `main`; it verifies the app, builds and scans both images, pushes unique immutable tags (`commit-run-attempt`), and deploys on the private runner using OIDC. It needs no stored AWS access keys.

`helm --atomic` rolls back an unsuccessful application rollout; database migrations are not automatically rolled back. The post-deployment HTTPS check happens after Helm, so investigate a failed external smoke check even when Helm reports success. Use additive, backward-compatible migrations for ordinary releases.

## Sources for platform choices

- [AWS EKS version lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html)
- [AWS Load Balancer Controller installation](https://docs.aws.amazon.com/eks/latest/userguide/lbc-helm.html); vendored policy in `infra/terraform/policies` comes from upstream release v2.14.1.
- [GitHub OIDC with AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)
- [External Secrets AWS authentication](https://external-secrets.io/v1.3.0/provider/aws-access/)
