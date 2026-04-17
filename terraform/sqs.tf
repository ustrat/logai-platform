# ── Renewal Alerts DLQ (Python Lambda stack) ──────────────────────────────────
resource "aws_sqs_queue" "alerts_dlq" {
  name                       = "valuepilot-event-dlq-${local.env}"
  message_retention_seconds  = 1209600 # 14 days
  visibility_timeout_seconds = 60
}

resource "aws_sqs_queue_policy" "alerts_dlq" {
  queue_url = aws_sqs_queue.alerts_dlq.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaSendMessage"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.alerts_dlq.arn
        Condition = {
          StringEquals = {
            "AWS:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# ── Email Intelligence Lambda DLQ ─────────────────────────────────────────────
resource "aws_sqs_queue" "email_intel_dlq" {
  name                       = "valuepilot-email-intel-dlq-${local.env}"
  message_retention_seconds  = 1209600 # 14 days
  visibility_timeout_seconds = 60
}

resource "aws_sqs_queue_policy" "email_intel_dlq" {
  queue_url = aws_sqs_queue.email_intel_dlq.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaSendMessage"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.email_intel_dlq.arn
        Condition = {
          StringEquals = {
            "AWS:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}
