resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.database[*].id
}
resource "aws_security_group" "database" {
  name        = "${local.name}-database"
  description = "PostgreSQL from EKS nodes only"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_eks_cluster.main.vpc_config[0].cluster_security_group_id]
    description     = "EKS application connections"
  }
}
resource "aws_db_parameter_group" "main" {
  name   = "${local.name}-postgres17"
  family = "postgres17"
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}
resource "aws_db_instance" "main" {
  identifier                      = local.name
  engine                          = "postgres"
  engine_version                  = "17"
  instance_class                  = var.db_instance_class
  allocated_storage               = 30
  max_allocated_storage           = 200
  storage_type                    = "gp3"
  storage_encrypted               = true
  db_name                         = "inventory"
  username                        = "inventory_owner"
  manage_master_user_password     = true
  db_subnet_group_name            = aws_db_subnet_group.main.name
  vpc_security_group_ids          = [aws_security_group.database.id]
  parameter_group_name            = aws_db_parameter_group.main.name
  multi_az                        = true
  publicly_accessible             = false
  backup_retention_period         = 14
  backup_window                   = "06:00-07:00"
  maintenance_window              = "sun:07:00-sun:08:00"
  deletion_protection             = var.deletion_protection
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${local.name}-final"
  copy_tags_to_snapshot           = true
  auto_minor_version_upgrade      = true
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
}
resource "random_password" "application" {
  length  = 40
  special = false
}
resource "aws_secretsmanager_secret" "application" {
  name                    = "${local.name}/application-database"
  recovery_window_in_days = 30
}
resource "aws_secretsmanager_secret_version" "application" {
  secret_id     = aws_secretsmanager_secret.application.id
  secret_string = jsonencode({ DATABASE_URL = "postgres://inventory_app:${random_password.application.result}@${aws_db_instance.main.address}:5432/inventory" })
}
resource "aws_cloudwatch_metric_alarm" "db_storage" {
  alarm_name          = "${local.name}-database-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5368709120
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  alarm_actions       = [aws_sns_topic.operations.arn]
}
resource "aws_sns_topic" "operations" { name = "${local.name}-operations" }
