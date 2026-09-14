variable "aws_region" {
  type    = string
  default = "us-east-1"
}
variable "environment" {
  type    = string
  default = "production"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Choose staging or production."
  }
}
variable "kubernetes_version" {
  type    = string
  default = "1.35"
}
variable "github_repository" {
  type        = string
  description = "Exact OWNER/REPO for GitHub OIDC trust."
  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Use OWNER/REPO."
  }
}
variable "github_oidc_provider_arn" {
  type        = string
  default     = ""
  description = "Existing account GitHub OIDC provider ARN; leave empty to create one."
}
variable "administrator_role_arn" {
  type        = string
  description = "Existing IAM role for platform administrators, including initial cluster setup."
}
variable "eks_public_access_cidrs" {
  type        = list(string)
  default     = []
  description = "Optional trusted admin egress CIDRs. Empty keeps the Kubernetes API private. Never use 0.0.0.0/0."
  validation {
    condition     = alltrue([for cidr in var.eks_public_access_cidrs : can(cidrnetmask(cidr)) && !contains(["0.0.0.0/0"], cidr)])
    error_message = "Use restricted IPv4 CIDRs; world access is forbidden."
  }
}
variable "node_instance_types" {
  type    = list(string)
  default = ["t3.large"]
}
variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}
variable "deletion_protection" {
  type    = bool
  default = true
}
