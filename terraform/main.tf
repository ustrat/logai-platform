terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }

  # Remote state — swap bucket/key for your environment
  backend "s3" {
    bucket         = "valuepilot-terraform-state"
    key            = "platform/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "valuepilot-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# ── Locals ────────────────────────────────────────────────────────────────────
locals {
  name_prefix = "vp"
  env         = var.environment

  common_tags = {
    Project     = "ValuePilot"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = "platform-team"
  }
}
