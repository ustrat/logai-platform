#!/usr/bin/env bash
# ValuePilot — CloudFormation resource import script
#
# Brings all Terraform-managed resources under CloudFormation management.
# Each stack is handled in two phases:
#   1. IMPORT  — minimal template (no Outputs), brings existing resources in
#   2. UPDATE  — full template, adds Outputs + any non-importable resources
#
# Usage:
#   ./cloudformation/import.sh [environment] [region]

set -euo pipefail

ENV="${1:-production}"
REGION="${2:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================="
echo "  ValuePilot CloudFormation Import"
echo "  Environment : $ENV"
echo "  Region      : $REGION"
echo "  Account     : $ACCOUNT_ID"
echo "========================================="

# ── Helper: check if a stack is already in a complete/stable state ────────────
stack_done() {
  local name="$1"
  local status
  status=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$name" \
    --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "DOES_NOT_EXIST")
  [[ "$status" == *_COMPLETE ]]
}

# ── Helper: create + execute an IMPORT changeset ─────────────────────────────
cfn_import() {
  local stack_name="$1"
  local template_body="$2"
  local resources_json="$3"
  shift 3
  local extra_params=("$@")

  local cs_name="import-$(date +%s)"
  echo "  Creating import changeset..."

  local params=("ParameterKey=Environment,ParameterValue=$ENV" "${extra_params[@]}")

  # Write template to a temp file; use cygpath to get the Windows path the AWS CLI expects
  local tmp_tpl tmp_win
  tmp_tpl=$(mktemp /tmp/cfn_tpl_XXXXXX.yaml)
  echo "$template_body" > "$tmp_tpl"
  tmp_win=$(cygpath -m "$tmp_tpl")

  aws cloudformation create-change-set \
    --region "$REGION" \
    --stack-name "$stack_name" \
    --change-set-name "$cs_name" \
    --change-set-type IMPORT \
    --resources-to-import "$resources_json" \
    --template-body "file://$tmp_win" \
    --parameters "${params[@]}" \
    --capabilities CAPABILITY_NAMED_IAM
  rm -f "$tmp_tpl"

  aws cloudformation wait change-set-create-complete \
    --region "$REGION" --stack-name "$stack_name" --change-set-name "$cs_name" || true

  local status
  status=$(aws cloudformation describe-change-set \
    --region "$REGION" --stack-name "$stack_name" --change-set-name "$cs_name" \
    --query "Status" --output text)

  if [[ "$status" == "FAILED" ]]; then
    local reason
    reason=$(aws cloudformation describe-change-set \
      --region "$REGION" --stack-name "$stack_name" --change-set-name "$cs_name" \
      --query "StatusReason" --output text)
    echo "  FAILED: $reason"
    return 1
  fi

  aws cloudformation execute-change-set \
    --region "$REGION" --stack-name "$stack_name" --change-set-name "$cs_name"

  echo "  Waiting for import to complete..."
  aws cloudformation wait stack-import-complete \
    --region "$REGION" --stack-name "$stack_name"
}

# ── Helper: regular deploy (create or update existing stack) ──────────────────
cfn_deploy() {
  local stack_name="$1"
  local template_file="$2"
  shift 2
  local extra_params=("$@")

  local params=("ParameterKey=Environment,ParameterValue=$ENV" "${extra_params[@]}")
  local tmp tmp_win
  tmp=$(mktemp /tmp/cfn_deploy_XXXXXX.yaml)
  cp "$template_file" "$tmp"
  tmp_win=$(cygpath -m "$tmp")

  aws cloudformation deploy \
    --region "$REGION" \
    --stack-name "$stack_name" \
    --template-file "$tmp_win" \
    --parameter-overrides "${params[@]}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset

  rm -f "$tmp"
}

# ═════════════════════════════════════════════════════════════════════════════
# STEP 1 — Messaging  (SNS topics + SQS queues)
# AWS::SNS::TopicPolicy and AWS::SQS::QueuePolicy don't support import,
# so Phase A imports only the topics/queues, Phase B adds policies/outputs.
# ═════════════════════════════════════════════════════════════════════════════
echo ""
if stack_done "valuepilot-messaging-$ENV"; then
  echo "── Step 1: Skipping messaging (already complete) ────────────────────────"
else
echo "── Step 1A: Importing messaging topics and queues ───────────────────────"
cfn_import "valuepilot-messaging-$ENV" \
'AWSTemplateFormatVersion: "2010-09-09"
Description: ValuePilot Messaging (import phase)
Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]
Resources:
  AlertsTopic:
    Type: AWS::SNS::Topic
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      TopicName: !Sub valuepilot-alerts-${Environment}
      DisplayName: ValuePilot Renewal Alerts
  EmailIntelSummariesTopic:
    Type: AWS::SNS::Topic
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      TopicName: !Sub valuepilot-email-intel-summaries-${Environment}
      DisplayName: ValuePilot Email Intel Scan Summaries
  CloudWatchAlarmsTopic:
    Type: AWS::SNS::Topic
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      TopicName: !Sub valuepilot-cw-alarms-${Environment}
  AlertsDlq:
    Type: AWS::SQS::Queue
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      QueueName: !Sub valuepilot-event-dlq-${Environment}
      MessageRetentionPeriod: 1209600
      VisibilityTimeout: 60
  EmailIntelDlq:
    Type: AWS::SQS::Queue
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      QueueName: !Sub valuepilot-email-intel-dlq-${Environment}
      MessageRetentionPeriod: 1209600
      VisibilityTimeout: 60' \
  '[
    {"ResourceType":"AWS::SNS::Topic","LogicalResourceId":"AlertsTopic","ResourceIdentifier":{"TopicArn":"arn:aws:sns:'"$REGION"':'"$ACCOUNT_ID"':valuepilot-alerts-'"$ENV"'"}},
    {"ResourceType":"AWS::SNS::Topic","LogicalResourceId":"EmailIntelSummariesTopic","ResourceIdentifier":{"TopicArn":"arn:aws:sns:'"$REGION"':'"$ACCOUNT_ID"':valuepilot-email-intel-summaries-'"$ENV"'"}},
    {"ResourceType":"AWS::SNS::Topic","LogicalResourceId":"CloudWatchAlarmsTopic","ResourceIdentifier":{"TopicArn":"arn:aws:sns:'"$REGION"':'"$ACCOUNT_ID"':valuepilot-cw-alarms-'"$ENV"'"}},
    {"ResourceType":"AWS::SQS::Queue","LogicalResourceId":"AlertsDlq","ResourceIdentifier":{"QueueUrl":"https://sqs.'"$REGION"'.amazonaws.com/'"$ACCOUNT_ID"'/valuepilot-event-dlq-'"$ENV"'"}},
    {"ResourceType":"AWS::SQS::Queue","LogicalResourceId":"EmailIntelDlq","ResourceIdentifier":{"QueueUrl":"https://sqs.'"$REGION"'.amazonaws.com/'"$ACCOUNT_ID"'/valuepilot-email-intel-dlq-'"$ENV"'"}}
  ]'

echo "✓ messaging topics/queues imported"
echo ""
echo "── Step 1B: Updating messaging with full template (outputs + policies) ──"
cfn_deploy "valuepilot-messaging-$ENV" "$DIR/messaging.yaml" \
  "ParameterKey=AlertEmail,ParameterValue=camir.inshiqaq@icpsystems.com"
echo "✓ valuepilot-messaging-$ENV complete"
fi

# ═════════════════════════════════════════════════════════════════════════════
# STEP 2 — S3 buckets
# ═════════════════════════════════════════════════════════════════════════════
echo ""
if stack_done "valuepilot-s3-$ENV"; then
  echo "── Step 2: Skipping S3 (already complete) ───────────────────────────────"
else
echo "── Step 2A: Importing S3 buckets ────────────────────────────────────────"
cfn_import "valuepilot-s3-$ENV" \
'AWSTemplateFormatVersion: "2010-09-09"
Description: ValuePilot S3 (import phase)
Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]
Resources:
  EmailIntelBucket:
    Type: AWS::S3::Bucket
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      BucketName: !Sub valuepilot-email-intel-${Environment}
  SamArtifactsBucket:
    Type: AWS::S3::Bucket
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      BucketName: !Sub "valuepilot-sam-artifacts-${AWS::AccountId}-${AWS::Region}"' \
  '[
    {"ResourceType":"AWS::S3::Bucket","LogicalResourceId":"EmailIntelBucket","ResourceIdentifier":{"BucketName":"valuepilot-email-intel-'"$ENV"'"}},
    {"ResourceType":"AWS::S3::Bucket","LogicalResourceId":"SamArtifactsBucket","ResourceIdentifier":{"BucketName":"valuepilot-sam-artifacts-'"$ACCOUNT_ID"'-'"$REGION"'"}}
  ]'

echo "✓ S3 buckets imported"
echo ""
echo "── Step 2B: Updating S3 with full template (versioning + lifecycle + outputs) ──"
cfn_deploy "valuepilot-s3-$ENV" "$DIR/s3.yaml"
echo "✓ valuepilot-s3-$ENV complete"
fi

# ═════════════════════════════════════════════════════════════════════════════
# STEP 3 — DynamoDB
# 11 existing tables imported + 7 addon tables created new in same changeset.
# ═════════════════════════════════════════════════════════════════════════════
echo ""
if stack_done "valuepilot-dynamodb-$ENV"; then
  echo "── Step 3: Skipping DynamoDB (already complete) ─────────────────────────"
else
echo "── Step 3A: Importing DynamoDB (11 existing + creating 7 new) ───────────"
cfn_import "valuepilot-dynamodb-$ENV" "$(awk '/^  # ── Table 12:/{exit} /^Outputs:/{exit} {print}' "$DIR/dynamodb.yaml")" \
  '[
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"UsersLogTable","ResourceIdentifier":{"TableName":"vp-users-log-'"$ENV"'"}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"TransactionsLogTable","ResourceIdentifier":{"TableName":"vp-transactions-log-'"$ENV"'"}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"SubscriptionsLogTable","ResourceIdentifier":{"TableName":"vp-subscriptions-log-'"$ENV"'"}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"PlaidLogTable","ResourceIdentifier":{"TableName":"vp-plaid-log-'"$ENV"'"}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"StripeLogTable","ResourceIdentifier":{"TableName":"vp-stripe-log-'"$ENV"'"}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"EnterpriseLogTable","ResourceIdentifier":{"TableName":"vp-enterprise-log-'"$ENV"'"}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"PartnerLogTable","ResourceIdentifier":{"TableName":"vp-partner-log-'"$ENV"'"}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"EmailIntelLogTable","ResourceIdentifier":{"TableName":"vp-email-intel-log-'"$ENV"'"}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"SignalsLogTable","ResourceIdentifier":{"TableName":"vp-signals-log-'"$ENV"'"}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"AlertsLogTable","ResourceIdentifier":{"TableName":"vp-alerts-log-'"$ENV"'"}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"MlInferenceLogTable","ResourceIdentifier":{"TableName":"vp-ml-inference-log-'"$ENV"'"}}
  ]'

echo "✓ DynamoDB tables imported/created"
echo ""
echo "── Step 3B: Updating DynamoDB with full template (adds outputs) ─────────"
cfn_deploy "valuepilot-dynamodb-$ENV" "$DIR/dynamodb.yaml"
echo "✓ valuepilot-dynamodb-$ENV complete"
fi

# ═════════════════════════════════════════════════════════════════════════════
# STEP 4 — IAM roles and policies
# Messaging + S3 exports are available now (set in steps 1B and 2B).
# ═════════════════════════════════════════════════════════════════════════════
echo ""
if stack_done "valuepilot-iam-$ENV"; then
  echo "── Step 4: Skipping IAM (already complete) ──────────────────────────────"
else
echo "── Step 4A: Importing IAM roles and policies ────────────────────────────"
cfn_import "valuepilot-iam-$ENV" "$(cat "$DIR/iam.yaml" | awk '/^Outputs:/{exit} {print}')" \
  '[
    {"ResourceType":"AWS::IAM::ManagedPolicy","LogicalResourceId":"DynamoDbLogWritePolicy","ResourceIdentifier":{"PolicyArn":"arn:aws:iam::'"$ACCOUNT_ID"':policy/valuepilot-dynamodb-log-write-'"$ENV"'"}},
    {"ResourceType":"AWS::IAM::ManagedPolicy","LogicalResourceId":"BedrockInvokePolicy","ResourceIdentifier":{"PolicyArn":"arn:aws:iam::'"$ACCOUNT_ID"':policy/valuepilot-bedrock-invoke-'"$ENV"'"}},
    {"ResourceType":"AWS::IAM::Role","LogicalResourceId":"AlertsLambdaRole","ResourceIdentifier":{"RoleName":"valuepilot-alerts-lambda-role-'"$ENV"'"}},
    {"ResourceType":"AWS::IAM::Role","LogicalResourceId":"EmailIntelLambdaRole","ResourceIdentifier":{"RoleName":"valuepilot-email-intel-role-'"$ENV"'"}},
    {"ResourceType":"AWS::IAM::Role","LogicalResourceId":"ApiTaskRole","ResourceIdentifier":{"RoleName":"valuepilot-api-task-role-'"$ENV"'"}}
  ]'

echo "✓ IAM resources imported"
echo ""
echo "── Step 4B: Updating IAM with full template (adds outputs) ─────────────"
cfn_deploy "valuepilot-iam-$ENV" "$DIR/iam.yaml"
echo "✓ valuepilot-iam-$ENV complete"
fi

# ═════════════════════════════════════════════════════════════════════════════
# STEP 5 — CloudWatch log groups, alarms, dashboard
# Messaging exports are available (set in step 1B).
# ═════════════════════════════════════════════════════════════════════════════
echo ""
if stack_done "valuepilot-cloudwatch-$ENV"; then
  echo "── Step 5: Skipping CloudWatch (already complete) ───────────────────────"
else
echo "── Step 5A: Importing CloudWatch resources ──────────────────────────────"
cfn_import "valuepilot-cloudwatch-$ENV" "$(cat "$DIR/cloudwatch.yaml" | awk '/^Outputs:/{exit} {print}')" \
  '[
    {"ResourceType":"AWS::Logs::LogGroup","LogicalResourceId":"LogGroupCancellationDeadline","ResourceIdentifier":{"LogGroupName":"/aws/lambda/valuepilot-cancellation-deadline-'"$ENV"'"}},
    {"ResourceType":"AWS::Logs::LogGroup","LogicalResourceId":"LogGroupHighRiskAccounts","ResourceIdentifier":{"LogGroupName":"/aws/lambda/valuepilot-high-risk-accounts-'"$ENV"'"}},
    {"ResourceType":"AWS::Logs::LogGroup","LogicalResourceId":"LogGroupPriceShock","ResourceIdentifier":{"LogGroupName":"/aws/lambda/valuepilot-price-shock-'"$ENV"'"}},
    {"ResourceType":"AWS::Logs::LogGroup","LogicalResourceId":"LogGroupUsageDecline","ResourceIdentifier":{"LogGroupName":"/aws/lambda/valuepilot-usage-decline-'"$ENV"'"}},
    {"ResourceType":"AWS::Logs::LogGroup","LogicalResourceId":"LogGroupPendingApprovals","ResourceIdentifier":{"LogGroupName":"/aws/lambda/valuepilot-pending-approvals-'"$ENV"'"}},
    {"ResourceType":"AWS::Logs::LogGroup","LogicalResourceId":"LogGroupIncompleteEvidence","ResourceIdentifier":{"LogGroupName":"/aws/lambda/valuepilot-incomplete-evidence-'"$ENV"'"}},
    {"ResourceType":"AWS::Logs::LogGroup","LogicalResourceId":"LogGroupAutoRenewDisabled","ResourceIdentifier":{"LogGroupName":"/aws/lambda/valuepilot-auto-renew-disabled-'"$ENV"'"}},
    {"ResourceType":"AWS::Logs::LogGroup","LogicalResourceId":"LogGroupEmailIntel","ResourceIdentifier":{"LogGroupName":"/aws/lambda/valuepilot-email-intel-scan-'"$ENV"'"}},
    {"ResourceType":"AWS::Logs::LogGroup","LogicalResourceId":"LogGroupApi","ResourceIdentifier":{"LogGroupName":"/valuepilot/api/'"$ENV"'"}},
    {"ResourceType":"AWS::CloudWatch::Alarm","LogicalResourceId":"AlarmEmailIntelErrors","ResourceIdentifier":{"AlarmName":"valuepilot-email-intel-errors-'"$ENV"'"}},
    {"ResourceType":"AWS::CloudWatch::Alarm","LogicalResourceId":"AlarmEmailIntelTimeout","ResourceIdentifier":{"AlarmName":"valuepilot-email-intel-timeout-'"$ENV"'"}},
    {"ResourceType":"AWS::CloudWatch::Alarm","LogicalResourceId":"AlarmCancellationDeadlineErrors","ResourceIdentifier":{"AlarmName":"valuepilot-cancellation-deadline-errors-'"$ENV"'"}},
    {"ResourceType":"AWS::CloudWatch::Alarm","LogicalResourceId":"AlarmHighRiskAccountsErrors","ResourceIdentifier":{"AlarmName":"valuepilot-high-risk-accounts-errors-'"$ENV"'"}},
    {"ResourceType":"AWS::CloudWatch::Alarm","LogicalResourceId":"AlarmPriceShockErrors","ResourceIdentifier":{"AlarmName":"valuepilot-price-shock-errors-'"$ENV"'"}},
    {"ResourceType":"AWS::CloudWatch::Alarm","LogicalResourceId":"AlarmUsageDeclineErrors","ResourceIdentifier":{"AlarmName":"valuepilot-usage-decline-errors-'"$ENV"'"}},
    {"ResourceType":"AWS::CloudWatch::Alarm","LogicalResourceId":"AlarmPendingApprovalsErrors","ResourceIdentifier":{"AlarmName":"valuepilot-pending-approvals-errors-'"$ENV"'"}},
    {"ResourceType":"AWS::CloudWatch::Alarm","LogicalResourceId":"AlarmIncompleteEvidenceErrors","ResourceIdentifier":{"AlarmName":"valuepilot-incomplete-evidence-errors-'"$ENV"'"}},
    {"ResourceType":"AWS::CloudWatch::Alarm","LogicalResourceId":"AlarmAutoRenewDisabledErrors","ResourceIdentifier":{"AlarmName":"valuepilot-auto-renew-disabled-errors-'"$ENV"'"}},
    {"ResourceType":"AWS::CloudWatch::Alarm","LogicalResourceId":"AlarmAlertsDlqDepth","ResourceIdentifier":{"AlarmName":"valuepilot-alerts-dlq-depth-'"$ENV"'"}},
    {"ResourceType":"AWS::CloudWatch::Alarm","LogicalResourceId":"AlarmEmailIntelDlqDepth","ResourceIdentifier":{"AlarmName":"valuepilot-email-intel-dlq-depth-'"$ENV"'"}},
    {"ResourceType":"AWS::CloudWatch::Dashboard","LogicalResourceId":"Dashboard","ResourceIdentifier":{"DashboardName":"ValuePilot-'"$ENV"'"}}
  ]' \
  "ParameterKey=LogRetentionDays,ParameterValue=30" \
  "ParameterKey=LambdaErrorThreshold,ParameterValue=3"

echo "✓ CloudWatch resources imported"
echo ""
echo "── Step 5B: Updating CloudWatch with full template (adds outputs) ───────"
cfn_deploy "valuepilot-cloudwatch-$ENV" "$DIR/cloudwatch.yaml" \
  "ParameterKey=LogRetentionDays,ParameterValue=30" \
  "ParameterKey=LambdaErrorThreshold,ParameterValue=3"
echo "✓ valuepilot-cloudwatch-$ENV complete"
fi

# ═════════════════════════════════════════════════════════════════════════════
# STEP 6 — Cognito (brand new, normal deploy)
# ═════════════════════════════════════════════════════════════════════════════
echo ""
if stack_done "valuepilot-cognito-$ENV"; then
  echo "── Step 6: Skipping Cognito (already complete) ──────────────────────────"
else
echo "── Step 6: Deploying Cognito (new resource) ─────────────────────────────"
cfn_deploy "valuepilot-cognito-$ENV" "$DIR/cognito.yaml" \
  "ParameterKey=ProjectName,ParameterValue=valuepilot"
echo "✓ valuepilot-cognito-$ENV complete"
fi

echo ""
echo "========================================="
echo "  All done!"
echo ""
echo "  NOTE: SSM parameters (/valuepilot/*) already exist"
echo "  with real values and are NOT managed by CloudFormation."
echo ""
echo "  Stacks:"
aws cloudformation list-stacks \
  --region "$REGION" \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE IMPORT_COMPLETE \
  --query "StackSummaries[?contains(StackName, 'valuepilot')].{Stack:StackName,Status:StackStatus}" \
  --output table
echo "========================================="
