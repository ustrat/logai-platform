# ══════════════════════════════════════════════════════════════════════════════
#  SSM Parameter Store — Placeholders
#  Values are set to "REPLACE_ME" on first apply.
#  Use the AWS Console or CLI to update each SecureString before deploying
#  the Lambda SAM stacks:
#    aws ssm put-parameter --name <name> --value <secret> --type SecureString --overwrite
# ══════════════════════════════════════════════════════════════════════════════

# ── Email Intelligence OAuth Credentials ─────────────────────────────────────
resource "aws_ssm_parameter" "google_client_id" {
  name        = "/valuepilot/email-intel/google-client-id"
  type        = "SecureString"
  value       = "REPLACE_ME"
  description = "Google OAuth 2.0 Client ID for Gmail email intelligence"

  lifecycle {
    ignore_changes = [value] # Prevent Terraform from overwriting secrets set externally
  }
}

resource "aws_ssm_parameter" "google_client_secret" {
  name        = "/valuepilot/email-intel/google-client-secret"
  type        = "SecureString"
  value       = "REPLACE_ME"
  description = "Google OAuth 2.0 Client Secret for Gmail email intelligence"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "ms_client_id" {
  name        = "/valuepilot/email-intel/ms-client-id"
  type        = "SecureString"
  value       = "REPLACE_ME"
  description = "Microsoft Azure AD Client ID for Outlook email intelligence"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "ms_client_secret" {
  name        = "/valuepilot/email-intel/ms-client-secret"
  type        = "SecureString"
  value       = "REPLACE_ME"
  description = "Microsoft Azure AD Client Secret for Outlook email intelligence"

  lifecycle {
    ignore_changes = [value]
  }
}

# ── Plaid Credentials ─────────────────────────────────────────────────────────
resource "aws_ssm_parameter" "plaid_client_id" {
  name        = "/valuepilot/plaid/client-id"
  type        = "SecureString"
  value       = "REPLACE_ME"
  description = "Plaid API Client ID"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "plaid_secret" {
  name        = "/valuepilot/plaid/secret"
  type        = "SecureString"
  value       = "REPLACE_ME"
  description = "Plaid API Secret (environment-specific)"

  lifecycle {
    ignore_changes = [value]
  }
}

# ── Stripe Credentials ────────────────────────────────────────────────────────
resource "aws_ssm_parameter" "stripe_secret_key" {
  name        = "/valuepilot/stripe/secret-key"
  type        = "SecureString"
  value       = "REPLACE_ME"
  description = "Stripe Secret Key (sk_live_... or sk_test_...)"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "stripe_webhook_secret" {
  name        = "/valuepilot/stripe/webhook-secret"
  type        = "SecureString"
  value       = "REPLACE_ME"
  description = "Stripe Webhook Endpoint Signing Secret (whsec_...)"

  lifecycle {
    ignore_changes = [value]
  }
}

# ── JWT Secret ────────────────────────────────────────────────────────────────
resource "aws_ssm_parameter" "jwt_secret" {
  name        = "/valuepilot/api/jwt-secret"
  type        = "SecureString"
  value       = "REPLACE_ME"
  description = "JWT signing secret for API authentication"

  lifecycle {
    ignore_changes = [value]
  }
}

# ── SMTP Credentials (invoice email) ──────────────────────────────────────────
resource "aws_ssm_parameter" "smtp_user" {
  name        = "/valuepilot/smtp/user"
  type        = "SecureString"
  value       = "REPLACE_ME"
  description = "SMTP username for invoice email delivery"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "smtp_password" {
  name        = "/valuepilot/smtp/password"
  type        = "SecureString"
  value       = "REPLACE_ME"
  description = "SMTP password for invoice email delivery"

  lifecycle {
    ignore_changes = [value]
  }
}
