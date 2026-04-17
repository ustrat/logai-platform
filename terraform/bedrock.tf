# ══════════════════════════════════════════════════════════════════════════════
#  AWS Bedrock — IAM permissions for all platform roles
#  Models used:
#    claude-3-5-sonnet  → complex reasoning (enterprise assistant, anomaly explain)
#    claude-3-5-haiku   → high-volume fast inference (email signals, subscription scan)
# ══════════════════════════════════════════════════════════════════════════════

locals {
  bedrock_model_arns = [
    # Foundation model ARNs
    "arn:aws:bedrock:${var.aws_region}::foundation-model/anthropic.claude-sonnet-4-6",
    "arn:aws:bedrock:${var.aws_region}::foundation-model/anthropic.claude-haiku-4-5-20251001",
    # Cross-region inference profile ARNs (required for on-demand throughput)
    "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/us.anthropic.claude-sonnet-4-6",
    "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/us.anthropic.claude-haiku-4-5-20251001",
  ]
}

# ── Shared Bedrock invocation policy ─────────────────────────────────────────
data "aws_iam_policy_document" "bedrock_invoke" {
  statement {
    sid    = "BedrockInvokeModels"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
      "bedrock:Converse",
      "bedrock:ConverseStream",
    ]
    resources = local.bedrock_model_arns
  }
}

resource "aws_iam_policy" "bedrock_invoke" {
  name        = "valuepilot-bedrock-invoke-${local.env}"
  description = "Allows ValuePilot services to invoke Claude models via Amazon Bedrock"
  policy      = data.aws_iam_policy_document.bedrock_invoke.json
}

# ── Attach to all roles that need Bedrock access ──────────────────────────────
resource "aws_iam_role_policy_attachment" "api_task_bedrock" {
  role       = aws_iam_role.api_task.name
  policy_arn = aws_iam_policy.bedrock_invoke.arn
}

resource "aws_iam_role_policy_attachment" "email_intel_lambda_bedrock" {
  role       = aws_iam_role.email_intel_lambda.name
  policy_arn = aws_iam_policy.bedrock_invoke.arn
}

resource "aws_iam_role_policy_attachment" "alerts_lambda_bedrock" {
  role       = aws_iam_role.alerts_lambda.name
  policy_arn = aws_iam_policy.bedrock_invoke.arn
}

# ── SSM — store model IDs so services can be updated without code deploys ─────
resource "aws_ssm_parameter" "bedrock_sonnet_model_id" {
  name        = "/valuepilot/bedrock/sonnet-model-id"
  type        = "String"
  value       = "us.anthropic.claude-sonnet-4-6"
  description = "Bedrock inference profile ID for Claude Sonnet 4.6 — used for complex reasoning tasks"
}

resource "aws_ssm_parameter" "bedrock_haiku_model_id" {
  name        = "/valuepilot/bedrock/haiku-model-id"
  type        = "String"
  value       = "us.anthropic.claude-haiku-4-5-20251001"
  description = "Bedrock inference profile ID for Claude Haiku 4.5 — used for high-volume fast inference"
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "bedrock_sonnet_model_id" {
  value       = aws_ssm_parameter.bedrock_sonnet_model_id.name
  description = "SSM parameter name for Claude Sonnet model ID"
}

output "bedrock_haiku_model_id" {
  value       = aws_ssm_parameter.bedrock_haiku_model_id.name
  description = "SSM parameter name for Claude Haiku model ID"
}
