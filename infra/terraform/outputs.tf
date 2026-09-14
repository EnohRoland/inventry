output "cluster_name" { value = aws_eks_cluster.main.name }
output "vpc_id" { value = aws_vpc.main.id }
output "private_subnet_ids" { value = aws_subnet.private[*].id }
output "ecr_repositories" { value = { for k, v in aws_ecr_repository.app : k => v.repository_url } }
output "database_host" { value = aws_db_instance.main.address }
output "database_master_secret_arn" { value = aws_db_instance.main.master_user_secret[0].secret_arn }
output "application_secret_arn" { value = aws_secretsmanager_secret.application.arn }
output "github_build_role_arn" { value = aws_iam_role.build.arn }
output "github_deploy_role_arn" { value = aws_iam_role.deploy.arn }
output "external_secrets_role_arn" { value = aws_iam_role.secrets.arn }
output "load_balancer_controller_role_arn" { value = aws_iam_role.lb.arn }
output "operations_topic_arn" { value = aws_sns_topic.operations.arn }
