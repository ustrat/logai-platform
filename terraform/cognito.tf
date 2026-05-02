# ──────────────────────────────────────────────────────────────────────────────
# Cognito User Pool — ValuePilot identity layer
# ──────────────────────────────────────────────────────────────────────────────

resource "aws_cognito_user_pool" "valuepilot" {
  name = "${var.project_name}-users"

  # Password policy (FedRAMP-aligned)
  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 3
  }

  # Email as the sign-in identifier
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Account recovery via email only
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email verification
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "ValuePilot — Verify your account"
    email_message        = "Your ValuePilot verification code is: {####}"
  }

  # TOTP MFA (optional — user can enable it)
  mfa_configuration = "OPTIONAL"
  software_token_mfa_configuration {
    enabled = true
  }

  # User attributes
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 5
      max_length = 254
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 100
    }
  }

  # Custom role attribute (admin | analyst | viewer)
  schema {
    name                = "role"
    attribute_data_type = "String"
    required            = false
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 50
    }
  }

  # Prevent account enumeration
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ── App Client (SPA — no client secret) ──────────────────────────────────────
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project_name}-web-client"
  user_pool_id = aws_cognito_user_pool.valuepilot.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  # Token validity
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  # Security
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  # Read/write allowed attributes for the client
  read_attributes  = ["email", "name", "custom:role"]
  write_attributes = ["email", "name", "custom:role"]
}

# ── Cognito Groups (role-based access) ───────────────────────────────────────
resource "aws_cognito_user_group" "admin" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.valuepilot.id
  description  = "Platform administrators"
  precedence   = 1
}

resource "aws_cognito_user_group" "analyst" {
  name         = "analyst"
  user_pool_id = aws_cognito_user_pool.valuepilot.id
  description  = "Standard analysts"
  precedence   = 2
}

resource "aws_cognito_user_group" "viewer" {
  name         = "viewer"
  user_pool_id = aws_cognito_user_pool.valuepilot.id
  description  = "Read-only viewers"
  precedence   = 3
}

# ── SSM — store pool IDs for the API and CI ──────────────────────────────────
resource "aws_ssm_parameter" "cognito_user_pool_id" {
  name  = "/${var.project_name}/${var.environment}/cognito/user_pool_id"
  type  = "String"
  value = aws_cognito_user_pool.valuepilot.id
  tags  = { Project = var.project_name, Environment = var.environment }
}

resource "aws_ssm_parameter" "cognito_client_id" {
  name  = "/${var.project_name}/${var.environment}/cognito/client_id"
  type  = "String"
  value = aws_cognito_user_pool_client.web.id
  tags  = { Project = var.project_name, Environment = var.environment }
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.valuepilot.id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.valuepilot.arn
}

output "cognito_client_id" {
  description = "Cognito App Client ID (use in frontend .env)"
  value       = aws_cognito_user_pool_client.web.id
}

output "cognito_jwks_uri" {
  description = "JWKS endpoint for backend token verification"
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.valuepilot.id}/.well-known/jwks.json"
}
