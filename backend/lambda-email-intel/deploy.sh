#!/usr/bin/env bash
# ValuePilot Email Intelligence — Lambda Deploy Script
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh production

set -euo pipefail

ENV=${1:-production}
REGION=${AWS_REGION:-us-east-1}
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
SAM_BUCKET="valuepilot-sam-artifacts-${ACCOUNT}-${REGION}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ValuePilot Email Intelligence Lambda Deploy"
echo "  Environment: $ENV | Region: $REGION | Account: $ACCOUNT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Ensure SAM artifacts bucket exists ─────────────────────────────────────
echo ""
echo "▶ Checking SAM artifacts bucket..."
if ! aws s3 ls "s3://${SAM_BUCKET}" --region "$REGION" &>/dev/null; then
  echo "  Creating bucket: $SAM_BUCKET"
  aws s3 mb "s3://${SAM_BUCKET}" --region "$REGION"
  aws s3api put-bucket-versioning \
    --bucket "$SAM_BUCKET" \
    --versioning-configuration Status=Enabled
fi
echo "  ✓ Bucket ready: $SAM_BUCKET"

# ── 2. Ensure SSM parameters exist ───────────────────────────────────────────
echo ""
echo "▶ Checking SSM parameters..."

put_ssm() {
  local name=$1 prompt=$2
  if aws ssm get-parameter --name "$name" --region "$REGION" &>/dev/null; then
    echo "  ✓ $name (already set)"
  else
    echo ""
    read -rsp "  Enter $prompt: " val; echo ""
    aws ssm put-parameter \
      --name "$name" \
      --value "$val" \
      --type SecureString \
      --region "$REGION"
    echo "  ✓ $name set"
  fi
}

put_ssm "/valuepilot/email-intel/google-client-id"     "Google OAuth Client ID"
put_ssm "/valuepilot/email-intel/google-client-secret" "Google OAuth Client Secret"
put_ssm "/valuepilot/email-intel/ms-client-id"         "Microsoft OAuth Client ID"
put_ssm "/valuepilot/email-intel/ms-client-secret"     "Microsoft OAuth Client Secret"

# ── 3. Install dependencies ───────────────────────────────────────────────────
echo ""
echo "▶ Installing dependencies..."
npm ci --prefer-offline

# ── 4. SAM build (esbuild bundles handler.ts + all imports) ──────────────────
echo ""
echo "▶ Building Lambda with SAM + esbuild..."
sam build \
  --template-file template.yaml \
  --config-env default \
  --parallel \
  --cached

# ── 5. Deploy ─────────────────────────────────────────────────────────────────
echo ""
echo "▶ Deploying to AWS..."
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name "valuepilot-email-intel-${ENV}" \
  --s3-bucket "$SAM_BUCKET" \
  --s3-prefix "email-intel" \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    "Environment=${ENV}" \
    "ScanIntervalHours=4" \
    "LookbackDays=90" \
    "MinConfidence=0.60" \
  --confirm-changeset \
  --no-fail-on-empty-changeset

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Deploy complete"
echo ""

# ── 6. Print outputs ──────────────────────────────────────────────────────────
echo "▶ Stack outputs:"
aws cloudformation describe-stacks \
  --stack-name "valuepilot-email-intel-${ENV}" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --output table

echo ""
echo "▶ Next steps:"
echo "  1. Add email account connections via the API:"
echo "     POST /api/v1/email-intel/connect/imap   (immediate)"
echo "     GET  /api/v1/email-intel/connect/gmail/url  (OAuth)"
echo ""
echo "  2. Trigger a manual scan to verify:"
echo "     POST /api/v1/email-intel/scan/trigger"
echo ""
echo "  3. Check CloudWatch logs:"
echo "     aws logs tail /aws/lambda/valuepilot-email-intel-scan-${ENV} --follow"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
