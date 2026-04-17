# ══════════════════════════════════════════════════════════════════════════════
#  Outputs — consumed by SAM stacks via `sam deploy --parameter-overrides`
#  or read at runtime from SSM/env vars injected by App Runner / ECS task defs.
# ══════════════════════════════════════════════════════════════════════════════

# ── DynamoDB Table ARNs ───────────────────────────────────────────────────────
output "dynamodb_users_log_arn" {
  value       = aws_dynamodb_table.users_log.arn
  description = "vp-users-log table ARN"
}

output "dynamodb_transactions_log_arn" {
  value       = aws_dynamodb_table.transactions_log.arn
  description = "vp-transactions-log table ARN"
}

output "dynamodb_subscriptions_log_arn" {
  value       = aws_dynamodb_table.subscriptions_log.arn
  description = "vp-subscriptions-log table ARN"
}

output "dynamodb_plaid_log_arn" {
  value       = aws_dynamodb_table.plaid_log.arn
  description = "vp-plaid-log table ARN"
}

output "dynamodb_stripe_log_arn" {
  value       = aws_dynamodb_table.stripe_log.arn
  description = "vp-stripe-log table ARN"
}

output "dynamodb_enterprise_log_arn" {
  value       = aws_dynamodb_table.enterprise_log.arn
  description = "vp-enterprise-log table ARN"
}

output "dynamodb_partner_log_arn" {
  value       = aws_dynamodb_table.partner_log.arn
  description = "vp-partner-log table ARN"
}

output "dynamodb_email_intel_log_arn" {
  value       = aws_dynamodb_table.email_intel_log.arn
  description = "vp-email-intel-log table ARN"
}

output "dynamodb_signals_log_arn" {
  value       = aws_dynamodb_table.signals_log.arn
  description = "vp-signals-log table ARN"
}

output "dynamodb_alerts_log_arn" {
  value       = aws_dynamodb_table.alerts_log.arn
  description = "vp-alerts-log table ARN"
}

output "dynamodb_ml_inference_log_arn" {
  value       = aws_dynamodb_table.ml_inference_log.arn
  description = "vp-ml-inference-log table ARN"
}

# ── DynamoDB Table Names (for env var injection) ──────────────────────────────
output "dynamodb_table_names" {
  description = "Map of all DynamoDB log table names — inject these as env vars"
  value = {
    users_log         = aws_dynamodb_table.users_log.name
    transactions_log  = aws_dynamodb_table.transactions_log.name
    subscriptions_log = aws_dynamodb_table.subscriptions_log.name
    plaid_log         = aws_dynamodb_table.plaid_log.name
    stripe_log        = aws_dynamodb_table.stripe_log.name
    enterprise_log    = aws_dynamodb_table.enterprise_log.name
    partner_log       = aws_dynamodb_table.partner_log.name
    email_intel_log   = aws_dynamodb_table.email_intel_log.name
    signals_log       = aws_dynamodb_table.signals_log.name
    alerts_log        = aws_dynamodb_table.alerts_log.name
    ml_inference_log  = aws_dynamodb_table.ml_inference_log.name
  }
}

# ── S3 Bucket Names ───────────────────────────────────────────────────────────
output "s3_email_intel_bucket" {
  value       = aws_s3_bucket.email_intel.bucket
  description = "Email intelligence S3 bucket name"
}

output "s3_sam_artifacts_bucket" {
  value       = aws_s3_bucket.sam_artifacts.bucket
  description = "SAM deployment artifacts bucket name"
}

# ── SNS Topic ARNs ────────────────────────────────────────────────────────────
output "sns_alerts_topic_arn" {
  value       = aws_sns_topic.alerts.arn
  description = "Renewal alerts SNS topic ARN — pass to SAM stacks as SnsTopicArn"
}

output "sns_email_intel_summaries_arn" {
  value       = aws_sns_topic.email_intel_summaries.arn
  description = "Email intel scan summaries SNS topic ARN"
}

output "sns_cloudwatch_alarms_arn" {
  value       = aws_sns_topic.cloudwatch_alarms.arn
  description = "CloudWatch alarm notification topic ARN"
}

# ── SQS DLQ ARNs ─────────────────────────────────────────────────────────────
output "sqs_alerts_dlq_arn" {
  value       = aws_sqs_queue.alerts_dlq.arn
  description = "Renewal alerts Lambda DLQ ARN"
}

output "sqs_email_intel_dlq_arn" {
  value       = aws_sqs_queue.email_intel_dlq.arn
  description = "Email intel Lambda DLQ ARN"
}

# ── IAM Role ARNs ─────────────────────────────────────────────────────────────
output "iam_alerts_lambda_role_arn" {
  value       = aws_iam_role.alerts_lambda.arn
  description = "IAM role ARN for renewal alert Lambda functions — use in SAM template Role override"
}

output "iam_email_intel_lambda_role_arn" {
  value       = aws_iam_role.email_intel_lambda.arn
  description = "IAM role ARN for email intel Lambda — use in backend/lambda-email-intel/template.yaml"
}

output "iam_api_task_role_arn" {
  value       = aws_iam_role.api_task.arn
  description = "IAM role ARN for API backend ECS/App Runner task"
}

# ── SSM Parameter Names (for runtime resolution) ──────────────────────────────
output "ssm_parameter_names" {
  description = "SSM parameter paths — set values before deploying Lambda stacks"
  value = {
    google_client_id     = aws_ssm_parameter.google_client_id.name
    google_client_secret = aws_ssm_parameter.google_client_secret.name
    ms_client_id         = aws_ssm_parameter.ms_client_id.name
    ms_client_secret     = aws_ssm_parameter.ms_client_secret.name
    plaid_client_id      = aws_ssm_parameter.plaid_client_id.name
    plaid_secret         = aws_ssm_parameter.plaid_secret.name
    stripe_secret_key    = aws_ssm_parameter.stripe_secret_key.name
    stripe_webhook_secret = aws_ssm_parameter.stripe_webhook_secret.name
    jwt_secret           = aws_ssm_parameter.jwt_secret.name
    smtp_user            = aws_ssm_parameter.smtp_user.name
    smtp_password        = aws_ssm_parameter.smtp_password.name
  }
}

# ── CloudWatch Dashboard URL ──────────────────────────────────────────────────
output "cloudwatch_dashboard_url" {
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.valuepilot.dashboard_name}"
  description = "Direct link to the ValuePilot CloudWatch dashboard"
}
