terraform {
  required_version = ">= 1.11.0, < 2.0.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    tls    = { source = "hashicorp/tls", version = "~> 4.0" }
    random = { source = "hashicorp/random", version = "~> 3.7" }
  }
  backend "s3" {}
}
provider "aws" {
  region = var.aws_region
  default_tags { tags = { Project = "Goshenignite", Application = "Inventory", Environment = var.environment, ManagedBy = "Terraform" } }
}
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" { state = "available" }
locals {
  name = "goshenignite-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)
}
