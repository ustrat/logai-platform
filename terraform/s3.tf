data "aws_caller_identity" "current" {}

# ── Email Intelligence S3 Bucket ──────────────────────────────────────────────
resource "aws_s3_bucket" "email_intel" {
  bucket = "valuepilot-email-intel-${local.env}"
}

resource "aws_s3_bucket_versioning" "email_intel" {
  bucket = aws_s3_bucket.email_intel.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "email_intel" {
  bucket = aws_s3_bucket.email_intel.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "email_intel" {
  bucket                  = aws_s3_bucket.email_intel.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "email_intel" {
  bucket = aws_s3_bucket.email_intel.id

  rule {
    id     = "expire-old-insights"
    status = "Enabled"
    filter { prefix = "insights/" }
    noncurrent_version_expiration { noncurrent_days = 90 }
  }

  rule {
    id     = "expire-old-connections"
    status = "Enabled"
    filter { prefix = "connections/" }
    noncurrent_version_expiration { noncurrent_days = 365 }
  }
}

# ── SAM Artifacts Bucket ──────────────────────────────────────────────────────
resource "aws_s3_bucket" "sam_artifacts" {
  bucket = "valuepilot-sam-artifacts-${data.aws_caller_identity.current.account_id}-${var.aws_region}"
}

resource "aws_s3_bucket_versioning" "sam_artifacts" {
  bucket = aws_s3_bucket.sam_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "sam_artifacts" {
  bucket = aws_s3_bucket.sam_artifacts.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "sam_artifacts" {
  bucket                  = aws_s3_bucket.sam_artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "sam_artifacts" {
  bucket = aws_s3_bucket.sam_artifacts.id

  # Clean up old deployment artifacts after 90 days
  rule {
    id     = "expire-old-artifacts"
    status = "Enabled"
    filter { prefix = "" }
    noncurrent_version_expiration { noncurrent_days = 90 }
  }
}
