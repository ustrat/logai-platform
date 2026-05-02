# ValuePilot -- CloudFormation deployment script (PowerShell)
# Deploys all stacks in dependency order.
#
# Usage:
#   .\cloudformation\deploy.ps1 [-Env production] [-Region us-east-1]
#
# Examples:
#   .\cloudformation\deploy.ps1
#   .\cloudformation\deploy.ps1 -Env staging -Region us-east-1
#   $env:ACM_CERT_ARN = "arn:aws:acm:..."; .\cloudformation\deploy.ps1

param(
    [string]$Env    = "production",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

$AllowedEnvs = @("development", "staging", "production")
if ($Env -notin $AllowedEnvs) {
    Write-Error "ERROR: -Env must be one of: $($AllowedEnvs -join ', ')"
    exit 1
}

$Dir = $PSScriptRoot

function Deploy-Stack {
    param(
        [string]$StackName,
        [string]$Template,
        [string[]]$ExtraParams = @()
    )

    Write-Host ""
    Write-Host "-- Deploying $StackName --"

    $params = @("ParameterKey=Environment,ParameterValue=$Env") + $ExtraParams

    aws cloudformation deploy `
        --region $Region `
        --stack-name $StackName `
        --template-file $Template `
        --parameter-overrides $params `
        --capabilities CAPABILITY_NAMED_IAM `
        --no-fail-on-empty-changeset

    if ($LASTEXITCODE -ne 0) {
        Write-Error "FAILED: $StackName"
        exit 1
    }
    Write-Host "OK $StackName deployed"
}

$AcmCertArn = $env:ACM_CERT_ARN

Write-Host "========================================="
Write-Host "  ValuePilot CloudFormation Deploy"
Write-Host "  Environment : $Env"
Write-Host "  Region      : $Region"
Write-Host "========================================="

# Step 0a: VPC -- must deploy before ALB and EKS
Deploy-Stack "valuepilot-vpc-$Env" "$Dir\vpc.yaml"

# Step 0c: EKS cluster -- depends on VPC exports (subnets, security groups)
Deploy-Stack "valuepilot-eks-$Env" "$Dir\eks.yaml"

# Step 0b: ALB -- depends on VPC exports; skip if ACM_CERT_ARN not set
if ($AcmCertArn) {
    Deploy-Stack "valuepilot-alb-$Env" "$Dir\alb.yaml" @(
        "ParameterKey=AcmCertificateArn,ParameterValue=$AcmCertArn"
    )
} else {
    Write-Host ""
    Write-Host "-- Skipping ALB (ACM_CERT_ARN not set) --"
    Write-Host "   Run:  `$env:ACM_CERT_ARN = 'arn:aws:acm:us-east-1:...:certificate/...'"
    Write-Host "   Then re-run this script to deploy the ALB."
}

# Step 1: KMS keys -- must deploy first; DynamoDB, S3, and IAM all reference these
Deploy-Stack "valuepilot-kms-$Env" "$Dir\kms.yaml"

# Step 2: Messaging -- SNS + SQS
Deploy-Stack "valuepilot-messaging-$Env" "$Dir\messaging.yaml" @(
    "ParameterKey=AlertEmail,ParameterValue=camir.inshiqaq@icpsystems.com"
)

# Step 3: S3 buckets -- depends on KMS exports
Deploy-Stack "valuepilot-s3-$Env" "$Dir\s3.yaml"

# Step 4: DynamoDB tables -- depends on KMS exports
Deploy-Stack "valuepilot-dynamodb-$Env" "$Dir\dynamodb.yaml"

# Step 5: IAM -- depends on KMS, S3, and Messaging exports
Deploy-Stack "valuepilot-iam-$Env" "$Dir\iam.yaml"

# Step 6: Secrets Manager
Deploy-Stack "valuepilot-secrets-$Env" "$Dir\secrets.yaml"

# Step 7: Cognito (initial deploy — no Pre-Token Lambda yet)
Deploy-Stack "valuepilot-cognito-$Env" "$Dir\cognito.yaml" @(
    "ParameterKey=ProjectName,ParameterValue=valuepilot"
)

# Step 7b: Entitlements system (DynamoDB tables, EventBridge, Firehose, S3, Lambdas)
Deploy-Stack "valuepilot-entitlements-$Env" "$Dir\entitlements.yaml"

# Step 7c: Re-deploy Cognito with Pre-Token Lambda wired up
$preTokenArn = aws cloudformation describe-stacks `
    --stack-name "valuepilot-entitlements-$Env" `
    --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='PreTokenLambdaArn'].OutputValue" `
    --output text
if ($preTokenArn) {
    Write-Host ""
    Write-Host "-- Wiring Pre-Token Lambda to Cognito ($preTokenArn) --"
    Deploy-Stack "valuepilot-cognito-$Env" "$Dir\cognito.yaml" @(
        "ParameterKey=ProjectName,ParameterValue=valuepilot",
        "ParameterKey=PreTokenLambdaArn,ParameterValue=$preTokenArn"
    )
}

# Step 8: CloudWatch -- depends on Messaging exports
Deploy-Stack "valuepilot-cloudwatch-$Env" "$Dir\cloudwatch.yaml" @(
    "ParameterKey=LogRetentionDays,ParameterValue=30",
    "ParameterKey=LambdaErrorThreshold,ParameterValue=3"
)

Write-Host ""
Write-Host "========================================="
Write-Host "  All stacks deployed successfully!"
Write-Host ""
Write-Host "  Next steps:"
Write-Host "  1. Confirm the SNS email subscription sent to your inbox."
Write-Host "  2. Populate Secrets Manager with real values:"
Write-Host "     aws secretsmanager put-secret-value --secret-id valuepilot/plaid"
Write-Host "       --secret-string '{""clientId"":""<id>"",""secret"":""<secret>""}'"
Write-Host "  3. Get Cognito IDs:"
Write-Host "     aws cloudformation describe-stacks --stack-name valuepilot-cognito-$Env --query 'Stacks[0].Outputs'"
Write-Host "  4. Configure kubectl for EKS:"
Write-Host "     aws eks update-kubeconfig --name valuepilot-$Env --region $Region"
Write-Host "  5. Apply Kubernetes manifests in order:"
Write-Host "     kubectl apply -f k8s\namespace.yaml"
Write-Host "     kubectl apply -f k8s\serviceaccount.yaml"
Write-Host "     kubectl apply -f k8s\api.yaml"
Write-Host "     kubectl apply -f k8s\web.yaml"
Write-Host "     kubectl apply -f k8s\ml-service.yaml"
Write-Host "  6. Whitelist NAT IPs at Plaid/Stripe dashboards:"
Write-Host "     AZ-1: 54.159.41.230  AZ-2: 52.206.65.79"
Write-Host "========================================="
