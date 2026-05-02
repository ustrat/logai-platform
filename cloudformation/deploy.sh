#!/usr/bin/env bash
# ValuePilot — CloudFormation deployment script
# Deploys all stacks in dependency order.
#
# Usage:
#   ./cloudformation/deploy.sh [environment] [region]
#
# Examples:
#   ./cloudformation/deploy.sh production us-east-1
#   ./cloudformation/deploy.sh staging us-east-1
#   ./cloudformation/deploy.sh development us-east-1

set -euo pipefail

ENV="${1:-production}"
REGION="${2:-us-east-1}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Validate environment
if [[ ! "$ENV" =~ ^(development|staging|production)$ ]]; then
  echo "ERROR: environment must be one of: development, staging, production"
  exit 1
fi

deploy_stack() {
  local stack_name="$1"
  local template="$2"
  shift 2
  local extra_params=("$@")

  echo ""
  echo "── Deploying $stack_name ────────────────────────────────────────────────"

  local params=(
    "ParameterKey=Environment,ParameterValue=$ENV"
    "${extra_params[@]}"
  )

  local template_win
  template_win=$(cygpath -m "$template")

  aws cloudformation deploy \
    --region "$REGION" \
    --stack-name "$stack_name" \
    --template-file "$template_win" \
    --parameter-overrides "${params[@]}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset

  echo "✓ $stack_name deployed"
}

ACM_CERT_ARN="${ACM_CERT_ARN:-}"  # export ACM_CERT_ARN=arn:aws:acm:... before running

echo "========================================="
echo "  ValuePilot CloudFormation Deploy"
echo "  Environment : $ENV"
echo "  Region      : $REGION"
echo "========================================="

# Step 0a: VPC — must deploy before ALB and EKS
deploy_stack "valuepilot-vpc-$ENV" "$DIR/vpc.yaml"

# Step 0c: EKS cluster — depends on VPC exports (subnets, security groups)
deploy_stack "valuepilot-eks-$ENV" "$DIR/eks.yaml"

# Step 0b: ALB — depends on VPC exports; skip if ACM_CERT_ARN not set
if [[ -n "$ACM_CERT_ARN" ]]; then
  deploy_stack "valuepilot-alb-$ENV" "$DIR/alb.yaml" \
    "ParameterKey=AcmCertificateArn,ParameterValue=$ACM_CERT_ARN"
else
  echo ""
  echo "── Skipping ALB (ACM_CERT_ARN not set) ─────────────────────────────────"
  echo "   Run:  export ACM_CERT_ARN=arn:aws:acm:us-east-1:...:certificate/..."
  echo "   Then re-run this script to deploy the ALB."
fi

# Step 1: KMS keys — must deploy first; DynamoDB, S3, and IAM all reference these
deploy_stack "valuepilot-kms-$ENV" "$DIR/kms.yaml"

# Step 2: Messaging — SNS + SQS (no dependencies; IAM imports from here)
deploy_stack "valuepilot-messaging-$ENV" "$DIR/messaging.yaml" \
  "ParameterKey=AlertEmail,ParameterValue=camir.inshiqaq@icpsystems.com"

# Step 3: S3 buckets — depends on KMS exports; IAM imports bucket ARN
deploy_stack "valuepilot-s3-$ENV" "$DIR/s3.yaml"

# Step 4: DynamoDB tables — depends on KMS exports
deploy_stack "valuepilot-dynamodb-$ENV" "$DIR/dynamodb.yaml"

# Step 5: IAM — depends on KMS, S3, and Messaging exports
deploy_stack "valuepilot-iam-$ENV" "$DIR/iam.yaml"

# Step 7: Secrets Manager (no cross-stack dependencies)
# NOTE: SSM parameters (/valuepilot/*) are managed outside CloudFormation to
#       protect existing SecureString values from being overwritten.
deploy_stack "valuepilot-secrets-$ENV" "$DIR/secrets.yaml"

# Step 8: Cognito (no cross-stack dependencies)
deploy_stack "valuepilot-cognito-$ENV" "$DIR/cognito.yaml" \
  "ParameterKey=ProjectName,ParameterValue=valuepilot"

# Step 9: CloudWatch — depends on Messaging exports
deploy_stack "valuepilot-cloudwatch-$ENV" "$DIR/cloudwatch.yaml" \
  "ParameterKey=LogRetentionDays,ParameterValue=30" \
  "ParameterKey=LambdaErrorThreshold,ParameterValue=3"

echo ""
echo "========================================="
echo "  All stacks deployed successfully!"
echo ""
echo "  Next steps:"
echo "  1. Confirm the SNS email subscription sent to your inbox."
echo "  2. Populate Secrets Manager with real values:"
echo "     aws secretsmanager put-secret-value --secret-id valuepilot/plaid \\"
echo "       --secret-string '{\"clientId\":\"<id>\",\"secret\":\"<secret>\"}'"
echo "  3. Get Cognito IDs for your frontend .env:"
echo "     aws cloudformation describe-stacks \\"
echo "       --stack-name valuepilot-cognito-$ENV \\"
echo "       --query 'Stacks[0].Outputs'"
echo "  4. Configure kubectl for EKS:"
echo "     aws eks update-kubeconfig --name valuepilot-$ENV --region $REGION"
echo "  5. Apply Kubernetes manifests in order:"
echo "     kubectl apply -f k8s/namespace.yaml"
echo "     kubectl apply -f k8s/serviceaccount.yaml"
echo "     kubectl apply -f k8s/api.yaml"
echo "     kubectl apply -f k8s/web.yaml"
echo "     kubectl apply -f k8s/ml-service.yaml"
echo "  6. Whitelist NAT IPs at Plaid/Stripe dashboards:"
echo "     AZ-1: 54.159.41.230  AZ-2: 52.206.65.79"
echo "========================================="
