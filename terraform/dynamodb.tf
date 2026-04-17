# ══════════════════════════════════════════════════════════════════════════════
#  ValuePilot — DynamoDB Log Tables
#  11 tables covering all platform domains.
#  All tables: On-Demand billing | PITR | AWS-owned KMS | TTL via `ttl` attr
# ══════════════════════════════════════════════════════════════════════════════

# ── Table 1: vp-users-log ─────────────────────────────────────────────────────
resource "aws_dynamodb_table" "users_log" {
  name         = "${local.name_prefix}-users-log-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "email"
    type = "S"
  }
  attribute {
    name = "eventType"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  # GSI1: look up all events by email
  global_secondary_index {
    name            = "GSI1-email-time"
    hash_key        = "email"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI2: query LOGIN/LOGOUT/ROLE_CHANGE across all users
  global_secondary_index {
    name            = "GSI2-eventType-time"
    hash_key        = "eventType"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
}

# ── Table 2: vp-transactions-log ──────────────────────────────────────────────
resource "aws_dynamodb_table" "transactions_log" {
  name         = "${local.name_prefix}-transactions-log-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "transactionId"
    type = "S"
  }
  attribute {
    name = "status"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  # GSI1: direct lookup by transaction ID
  global_secondary_index {
    name            = "GSI1-txnId"
    hash_key        = "transactionId"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI2: query failed/pending/reversed transactions
  global_secondary_index {
    name            = "GSI2-status-time"
    hash_key        = "status"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI3: all transactions for a user across accounts
  global_secondary_index {
    name            = "GSI3-userId-time"
    hash_key        = "userId"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"
}

# ── Table 3: vp-subscriptions-log ────────────────────────────────────────────
resource "aws_dynamodb_table" "subscriptions_log" {
  name         = "${local.name_prefix}-subscriptions-log-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "merchant"
    type = "S"
  }
  attribute {
    name = "status"
    type = "S"
  }
  attribute {
    name = "subscriptionId"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  # GSI1: all detections for a merchant across all users
  global_secondary_index {
    name            = "GSI1-merchant-time"
    hash_key        = "merchant"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI2: all at_risk or cancelled subscriptions
  global_secondary_index {
    name            = "GSI2-status-time"
    hash_key        = "status"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI3: full lifecycle of one subscription
  global_secondary_index {
    name            = "GSI3-subId"
    hash_key        = "subscriptionId"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"
}

# ── Table 4: vp-plaid-log ─────────────────────────────────────────────────────
resource "aws_dynamodb_table" "plaid_log" {
  name         = "${local.name_prefix}-plaid-log-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "itemId"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  # GSI1: all events for a Plaid item
  global_secondary_index {
    name            = "GSI1-itemId"
    hash_key        = "itemId"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"
}

# ── Table 5: vp-stripe-log ────────────────────────────────────────────────────
resource "aws_dynamodb_table" "stripe_log" {
  name         = "${local.name_prefix}-stripe-log-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "stripeSubscriptionId"
    type = "S"
  }
  attribute {
    name = "eventType"
    type = "S"
  }
  attribute {
    name = "stripeEventId"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  # GSI1: full lifecycle of a Stripe subscription
  global_secondary_index {
    name            = "GSI1-stripeSubId-time"
    hash_key        = "stripeSubscriptionId"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI2: all subscription.deleted events etc.
  global_secondary_index {
    name            = "GSI2-eventType-time"
    hash_key        = "eventType"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI3: idempotency check — has this webhook been processed?
  global_secondary_index {
    name            = "GSI3-stripeEventId"
    hash_key        = "stripeEventId"
    projection_type = "KEYS_ONLY"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"
}

# ── Table 6: vp-enterprise-log ────────────────────────────────────────────────
resource "aws_dynamodb_table" "enterprise_log" {
  name         = "${local.name_prefix}-enterprise-log-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "orderId"
    type = "S"
  }
  attribute {
    name = "salesPersonId"
    type = "S"
  }
  attribute {
    name = "status"
    type = "S"
  }
  attribute {
    name = "invoiceId"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  # GSI1: full lifecycle of a single order
  global_secondary_index {
    name            = "GSI1-orderId-time"
    hash_key        = "orderId"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI2: all orders for a sales person
  global_secondary_index {
    name            = "GSI2-salesPerson-time"
    hash_key        = "salesPersonId"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI3: pipeline view — all pending_finance orders
  global_secondary_index {
    name            = "GSI3-status-time"
    hash_key        = "status"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI4: invoice lifecycle
  global_secondary_index {
    name            = "GSI4-invoiceId"
    hash_key        = "invoiceId"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
}

# ── Table 7: vp-partner-log ───────────────────────────────────────────────────
resource "aws_dynamodb_table" "partner_log" {
  name         = "${local.name_prefix}-partner-log-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "memberId"
    type = "S"
  }
  attribute {
    name = "actorEmail"
    type = "S"
  }
  attribute {
    name = "memberEmail"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  # GSI1: all events for a specific member
  global_secondary_index {
    name            = "GSI1-memberId-time"
    hash_key        = "memberId"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI2: all actions performed by an actor
  global_secondary_index {
    name            = "GSI2-actorEmail-time"
    hash_key        = "actorEmail"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI3: look up member history by email
  global_secondary_index {
    name            = "GSI3-email-time"
    hash_key        = "memberEmail"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
}

# ── Table 8: vp-email-intel-log ───────────────────────────────────────────────
resource "aws_dynamodb_table" "email_intel_log" {
  name         = "${local.name_prefix}-email-intel-log-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "provider"
    type = "S"
  }
  attribute {
    name = "connectedEmail"
    type = "S"
  }
  attribute {
    name = "status"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  # GSI1: all Gmail / Outlook / IMAP connections
  global_secondary_index {
    name            = "GSI1-provider-time"
    hash_key        = "provider"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI2: find connection by email address
  global_secondary_index {
    name            = "GSI2-email-time"
    hash_key        = "connectedEmail"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI3: all errored connections
  global_secondary_index {
    name            = "GSI3-status-time"
    hash_key        = "status"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"
}

# ── Table 9: vp-signals-log ───────────────────────────────────────────────────
resource "aws_dynamodb_table" "signals_log" {
  name         = "${local.name_prefix}-signals-log-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "productKey"
    type = "S"
  }
  attribute {
    name = "urgency"
    type = "S"
  }
  attribute {
    name = "runId"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  # GSI1: all high-urgency signals for a product
  global_secondary_index {
    name            = "GSI1-productKey-urgency"
    hash_key        = "productKey"
    range_key       = "urgency"
    projection_type = "ALL"
  }

  # GSI2: all signals from a specific scan run
  global_secondary_index {
    name            = "GSI2-runId-product"
    hash_key        = "runId"
    range_key       = "productKey"
    projection_type = "ALL"
  }

  # GSI3: all signals for a user by product
  global_secondary_index {
    name            = "GSI3-userId-product"
    hash_key        = "userId"
    range_key       = "productKey"
    projection_type = "ALL"
  }

  # GSI4: time-series across all signals
  global_secondary_index {
    name            = "GSI4-productKey-time"
    hash_key        = "productKey"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"
}

# ── Table 10: vp-alerts-log ───────────────────────────────────────────────────
resource "aws_dynamodb_table" "alerts_log" {
  name         = "${local.name_prefix}-alerts-log-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "alertType"
    type = "S"
  }
  attribute {
    name = "subscriptionId"
    type = "S"
  }
  attribute {
    name = "severity"
    type = "S"
  }
  attribute {
    name = "functionName"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  # GSI1: all alerts of a given type
  global_secondary_index {
    name            = "GSI1-alertType-time"
    hash_key        = "alertType"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI2: all alerts for a subscription
  global_secondary_index {
    name            = "GSI2-subId-time"
    hash_key        = "subscriptionId"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI3: all critical alerts across the platform
  global_secondary_index {
    name            = "GSI3-severity-time"
    hash_key        = "severity"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI4: audit per Lambda function
  global_secondary_index {
    name            = "GSI4-functionName-time"
    hash_key        = "functionName"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
}

# ── Table 11: vp-ml-inference-log ─────────────────────────────────────────────
resource "aws_dynamodb_table" "ml_inference_log" {
  name         = "${local.name_prefix}-ml-inference-log-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "topSeverity"
    type = "S"
  }
  attribute {
    name = "inferenceId"
    type = "S"
  }
  attribute {
    name = "modelVersion"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  # GSI1: all inferences for a user
  global_secondary_index {
    name            = "GSI1-userId-time"
    hash_key        = "userId"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI2: all critical inference results
  global_secondary_index {
    name            = "GSI2-severity-time"
    hash_key        = "topSeverity"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  # GSI3: direct lookup by inference ID
  global_secondary_index {
    name            = "GSI3-inferenceId"
    hash_key        = "inferenceId"
    projection_type = "KEYS_ONLY"
  }

  # GSI4: inferences run with a specific model version
  global_secondary_index {
    name            = "GSI4-modelVersion-time"
    hash_key        = "modelVersion"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"
}
