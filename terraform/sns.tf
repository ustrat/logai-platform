# ── ValuePilot Alerts SNS Topic ───────────────────────────────────────────────
resource "aws_sns_topic" "alerts" {
  name         = "valuepilot-alerts-${local.env}"
  display_name = "ValuePilot Renewal Alerts"
}

# Optional: email subscription for ops team
resource "aws_sns_topic_subscription" "alerts_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Topic policy — allow Lambda functions and EventBridge to publish
resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaPublish"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.alerts.arn
        Condition = {
          StringEquals = {
            "AWS:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "AllowEventBridgePublish"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.alerts.arn
      }
    ]
  })
}

# ── Email Intelligence SNS Topic (scan summaries) ─────────────────────────────
resource "aws_sns_topic" "email_intel_summaries" {
  name         = "valuepilot-email-intel-summaries-${local.env}"
  display_name = "ValuePilot Email Intel Scan Summaries"
}
