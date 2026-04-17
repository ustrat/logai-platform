variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "production"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "environment must be one of: development, staging, production."
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region for all resources"
  default     = "us-east-1"
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log group retention in days"
  default     = 30
}

# ── TTL durations (days) ──────────────────────────────────────────────────────
variable "ttl_users_days" {
  type    = number
  default = 365
}

variable "ttl_transactions_days" {
  type    = number
  default = 90
}

variable "ttl_subscriptions_days" {
  type    = number
  default = 180
}

variable "ttl_plaid_days" {
  type    = number
  default = 365
}

variable "ttl_stripe_days" {
  type    = number
  default = 365
}

variable "ttl_enterprise_days" {
  type    = number
  default = 730
}

variable "ttl_partner_days" {
  type    = number
  default = 730
}

variable "ttl_email_intel_days" {
  type    = number
  default = 90
}

variable "ttl_signals_days" {
  type    = number
  default = 90
}

variable "ttl_alerts_days" {
  type    = number
  default = 90
}

variable "ttl_ml_inference_days" {
  type    = number
  default = 90
}

# ── Alert thresholds ──────────────────────────────────────────────────────────
variable "alert_email" {
  type        = string
  description = "Email address for CloudWatch alarm notifications"
  default     = "camir.inshiqaq@icpsystems.com"
}

variable "lambda_error_threshold" {
  type        = number
  description = "Number of Lambda errors per hour before alarm triggers"
  default     = 3
}
