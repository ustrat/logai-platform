data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# ── Shared DynamoDB write policy (all 11 log tables) ─────────────────────────
data "aws_iam_policy_document" "dynamodb_log_write" {
  statement {
    sid    = "DynamoDBLogWrite"
    effect = "Allow"
    actions = [
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:BatchWriteItem",
    ]
    resources = [
      aws_dynamodb_table.users_log.arn,
      aws_dynamodb_table.transactions_log.arn,
      aws_dynamodb_table.subscriptions_log.arn,
      aws_dynamodb_table.plaid_log.arn,
      aws_dynamodb_table.stripe_log.arn,
      aws_dynamodb_table.enterprise_log.arn,
      aws_dynamodb_table.partner_log.arn,
      aws_dynamodb_table.email_intel_log.arn,
      aws_dynamodb_table.signals_log.arn,
      aws_dynamodb_table.alerts_log.arn,
      aws_dynamodb_table.ml_inference_log.arn,
      # Include GSI ARNs for query access
      "${aws_dynamodb_table.users_log.arn}/index/*",
      "${aws_dynamodb_table.transactions_log.arn}/index/*",
      "${aws_dynamodb_table.subscriptions_log.arn}/index/*",
      "${aws_dynamodb_table.plaid_log.arn}/index/*",
      "${aws_dynamodb_table.stripe_log.arn}/index/*",
      "${aws_dynamodb_table.enterprise_log.arn}/index/*",
      "${aws_dynamodb_table.partner_log.arn}/index/*",
      "${aws_dynamodb_table.email_intel_log.arn}/index/*",
      "${aws_dynamodb_table.signals_log.arn}/index/*",
      "${aws_dynamodb_table.alerts_log.arn}/index/*",
      "${aws_dynamodb_table.ml_inference_log.arn}/index/*",
    ]
  }
}

resource "aws_iam_policy" "dynamodb_log_write" {
  name        = "valuepilot-dynamodb-log-write-${local.env}"
  description = "Allows Lambda functions to write to all ValuePilot DynamoDB log tables"
  policy      = data.aws_iam_policy_document.dynamodb_log_write.json
}

# ── Renewal Alerts Lambda Role (Python stack — 7 functions) ──────────────────
resource "aws_iam_role" "alerts_lambda" {
  name               = "valuepilot-alerts-lambda-role-${local.env}"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "alerts_lambda_basic" {
  role       = aws_iam_role.alerts_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "alerts_lambda_dynamo" {
  role       = aws_iam_role.alerts_lambda.name
  policy_arn = aws_iam_policy.dynamodb_log_write.arn
}

resource "aws_iam_role_policy" "alerts_lambda_inline" {
  name = "alerts-lambda-inline-${local.env}"
  role = aws_iam_role.alerts_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "PublishToAlertsTopic"
        Effect   = "Allow"
        Action   = "sns:Publish"
        Resource = aws_sns_topic.alerts.arn
      },
      {
        Sid      = "SendToDLQ"
        Effect   = "Allow"
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.alerts_dlq.arn
      },
      {
        Sid    = "PutMetrics"
        Effect = "Allow"
        Action = "cloudwatch:PutMetricData"
        Resource = "*"
      }
    ]
  })
}

# ── Email Intelligence Lambda Role (Node.js SAM stack) ───────────────────────
resource "aws_iam_role" "email_intel_lambda" {
  name               = "valuepilot-email-intel-role-${local.env}"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "email_intel_lambda_basic" {
  role       = aws_iam_role.email_intel_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "email_intel_lambda_dynamo" {
  role       = aws_iam_role.email_intel_lambda.name
  policy_arn = aws_iam_policy.dynamodb_log_write.arn
}

resource "aws_iam_role_policy" "email_intel_lambda_inline" {
  name = "email-intel-lambda-inline-${local.env}"
  role = aws_iam_role.email_intel_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3EmailIntel"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.email_intel.arn,
          "${aws_s3_bucket.email_intel.arn}/*"
        ]
      },
      {
        Sid      = "PublishScanSummaries"
        Effect   = "Allow"
        Action   = "sns:Publish"
        Resource = aws_sns_topic.email_intel_summaries.arn
      },
      {
        Sid    = "ReadOAuthSSMParams"
        Effect = "Allow"
        Action = "ssm:GetParameter"
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/valuepilot/email-intel/*"
      },
      {
        Sid      = "SendToDLQ"
        Effect   = "Allow"
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.email_intel_dlq.arn
      },
      {
        Sid    = "PutMetrics"
        Effect = "Allow"
        Action = "cloudwatch:PutMetricData"
        Resource = "*"
      }
    ]
  })
}

# ── API Backend Role (ECS / App Runner task role) ────────────────────────────
resource "aws_iam_role" "api_task" {
  name               = "valuepilot-api-task-role-${local.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = ["ecs-tasks.amazonaws.com", "tasks.apprunner.amazonaws.com"]
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api_task_dynamo" {
  role       = aws_iam_role.api_task.name
  policy_arn = aws_iam_policy.dynamodb_log_write.arn
}

resource "aws_iam_role_policy" "api_task_inline" {
  name = "api-task-inline-${local.env}"
  role = aws_iam_role.api_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadSSMParams"
        Effect = "Allow"
        Action = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/valuepilot/*"
      },
      {
        Sid    = "PutMetrics"
        Effect = "Allow"
        Action = "cloudwatch:PutMetricData"
        Resource = "*"
      }
    ]
  })
}
