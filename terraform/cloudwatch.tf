# ══════════════════════════════════════════════════════════════════════════════
#  CloudWatch — Log Groups and Alarms
# ══════════════════════════════════════════════════════════════════════════════

# ── Alarm notification topic ──────────────────────────────────────────────────
resource "aws_sns_topic" "cloudwatch_alarms" {
  name = "valuepilot-cw-alarms-${local.env}"
}

resource "aws_sns_topic_subscription" "cw_alarms_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.cloudwatch_alarms.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ── Log Groups — Renewal Alert Lambda functions (7) ───────────────────────────
locals {
  alert_functions = [
    "cancellation-deadline",
    "high-risk-accounts",
    "price-shock",
    "usage-decline",
    "pending-approvals",
    "incomplete-evidence",
    "auto-renew-disabled",
  ]
}

resource "aws_cloudwatch_log_group" "alert_functions" {
  for_each          = toset(local.alert_functions)
  name              = "/aws/lambda/valuepilot-${each.key}-${local.env}"
  retention_in_days = var.log_retention_days
}

# ── Log Group — Email Intelligence Lambda ─────────────────────────────────────
resource "aws_cloudwatch_log_group" "email_intel" {
  name              = "/aws/lambda/valuepilot-email-intel-scan-${local.env}"
  retention_in_days = var.log_retention_days
}

# ── Log Group — API Backend ───────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "api" {
  name              = "/valuepilot/api/${local.env}"
  retention_in_days = var.log_retention_days
}

# ── Alarms — Email Intel Lambda ───────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "email_intel_errors" {
  alarm_name          = "valuepilot-email-intel-errors-${local.env}"
  alarm_description   = "Email Intel Lambda is throwing errors"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = var.lambda_error_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = "valuepilot-email-intel-scan-${local.env}"
  }

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]
  ok_actions    = [aws_sns_topic.cloudwatch_alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "email_intel_timeout" {
  alarm_name          = "valuepilot-email-intel-timeout-${local.env}"
  alarm_description   = "Email Intel Lambda is approaching 10-minute timeout"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  statistic           = "Maximum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = 480000 # 8 minutes (80% of 600s timeout)
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = "valuepilot-email-intel-scan-${local.env}"
  }

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]
}

# ── Alarms — Renewal Alert Lambdas (one error alarm per function) ─────────────
resource "aws_cloudwatch_metric_alarm" "alert_function_errors" {
  for_each = toset(local.alert_functions)

  alarm_name          = "valuepilot-${each.key}-errors-${local.env}"
  alarm_description   = "valuepilot-${each.key} Lambda is throwing errors"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = var.lambda_error_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = "valuepilot-${each.key}-${local.env}"
  }

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]
  ok_actions    = [aws_sns_topic.cloudwatch_alarms.arn]
}

# ── Alarm — DLQ depth (alerts when messages pile up in either DLQ) ────────────
resource "aws_cloudwatch_metric_alarm" "alerts_dlq_depth" {
  alarm_name          = "valuepilot-alerts-dlq-depth-${local.env}"
  alarm_description   = "Renewal alerts DLQ has unprocessed messages"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.alerts_dlq.name
  }

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "email_intel_dlq_depth" {
  alarm_name          = "valuepilot-email-intel-dlq-depth-${local.env}"
  alarm_description   = "Email Intel DLQ has unprocessed messages"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.email_intel_dlq.name
  }

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]
}

# ── Dashboard ─────────────────────────────────────────────────────────────────
resource "aws_cloudwatch_dashboard" "valuepilot" {
  dashboard_name = "ValuePilot-${local.env}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Lambda Errors — All Functions"
          region  = var.aws_region
          period  = 3600
          stat    = "Sum"
          view    = "timeSeries"
          stacked = false
          metrics = concat(
            [for fn in local.alert_functions : ["AWS/Lambda", "Errors", "FunctionName", "valuepilot-${fn}-${local.env}"]],
            [["AWS/Lambda", "Errors", "FunctionName", "valuepilot-email-intel-scan-${local.env}"]]
          )
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "DLQ Depth"
          region  = var.aws_region
          period  = 300
          stat    = "Sum"
          view    = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.alerts_dlq.name],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.email_intel_dlq.name],
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "Email Intel Lambda Duration"
          region  = var.aws_region
          period  = 3600
          stat    = "Maximum"
          view    = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", "valuepilot-email-intel-scan-${local.env}"]
          ]
        }
      }
    ]
  })
}
