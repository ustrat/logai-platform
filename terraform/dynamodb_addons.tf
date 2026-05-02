# ══════════════════════════════════════════════════════════════════════════════
#  Add-On Services — 7 tables (Tables 12–18)
#  All tables: On-Demand | PITR | AWS-owned KMS | TTL | Streams
# ══════════════════════════════════════════════════════════════════════════════

# ── Table 12: vp-reminders-log (SmartReminder™) ───────────────────────────────
resource "aws_dynamodb_table" "reminders_log" {
  name         = "${local.name_prefix}-reminders-log-${local.env}"
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
    name = "status"
    type = "S"
  }
  attribute {
    name = "priority"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  global_secondary_index {
    name            = "GSI1-status-time"
    hash_key        = "status"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI2-priority-time"
    hash_key        = "priority"
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

# ── Table 13: vp-drafts-log (AutoDraft™) ─────────────────────────────────────
resource "aws_dynamodb_table" "drafts_log" {
  name         = "${local.name_prefix}-drafts-log-${local.env}"
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
    name = "draftType"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  global_secondary_index {
    name            = "GSI1-draftType-time"
    hash_key        = "draftType"
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

# ── Table 14: vp-spend-log (SpendAnalyzer™) ──────────────────────────────────
resource "aws_dynamodb_table" "spend_log" {
  name         = "${local.name_prefix}-spend-log-${local.env}"
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
    name = "category"
    type = "S"
  }
  attribute {
    name = "vendor"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  global_secondary_index {
    name            = "GSI1-category-time"
    hash_key        = "category"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI2-vendor-time"
    hash_key        = "vendor"
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

# ── Table 15: vp-contracts-log (ContractWatch™) ───────────────────────────────
resource "aws_dynamodb_table" "contracts_log" {
  name         = "${local.name_prefix}-contracts-log-${local.env}"
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
    name = "riskLevel"
    type = "S"
  }
  attribute {
    name = "status"
    type = "S"
  }
  attribute {
    name = "vendor"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  global_secondary_index {
    name            = "GSI1-riskLevel-time"
    hash_key        = "riskLevel"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI2-status-time"
    hash_key        = "status"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI3-vendor-time"
    hash_key        = "vendor"
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

# ── Table 16: vp-currency-log (CurrencyGuard™) ───────────────────────────────
resource "aws_dynamodb_table" "currency_log" {
  name         = "${local.name_prefix}-currency-log-${local.env}"
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
    name = "currencyPair"
    type = "S"
  }
  attribute {
    name = "severity"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  global_secondary_index {
    name            = "GSI1-currencyPair-time"
    hash_key        = "currencyPair"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI2-severity-time"
    hash_key        = "severity"
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

# ── Table 17: vp-tax-log (TaxNormalizer™) ────────────────────────────────────
resource "aws_dynamodb_table" "tax_log" {
  name         = "${local.name_prefix}-tax-log-${local.env}"
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
    name = "jurisdiction"
    type = "S"
  }
  attribute {
    name = "classification"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  global_secondary_index {
    name            = "GSI1-jurisdiction-time"
    hash_key        = "jurisdiction"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI2-classification-time"
    hash_key        = "classification"
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

# ── Table 18: vp-escalations-log (EscalateAI™) ───────────────────────────────
resource "aws_dynamodb_table" "escalations_log" {
  name         = "${local.name_prefix}-escalations-log-${local.env}"
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
    name = "status"
    type = "S"
  }
  attribute {
    name = "escalationType"
    type = "S"
  }
  attribute {
    name = "triggeredBy"
    type = "S"
  }
  attribute {
    name = "timestamp_ms"
    type = "N"
  }

  global_secondary_index {
    name            = "GSI1-status-time"
    hash_key        = "status"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI2-escalationType-time"
    hash_key        = "escalationType"
    range_key       = "timestamp_ms"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI3-triggeredBy-time"
    hash_key        = "triggeredBy"
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
