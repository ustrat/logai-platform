# ValuePilot - Pause script
# Tears down compute (EKS) to minimize costs while keeping all data intact.
# Resume with: .\cloudformation\resume.ps1
#
# Saves ~$133/month (EKS control plane + nodes + NAT Gateways)
# Data preserved: DynamoDB, Cognito, Secrets Manager, ECR images, S3

param(
    [string]$Env    = "production",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================="
Write-Host "  ValuePilot - Pause (cost savings mode)"
Write-Host "  Environment : $Env"
Write-Host "  Region      : $Region"
Write-Host "========================================="
Write-Host ""
Write-Host "This will DELETE the EKS stack (cluster + nodes + NAT Gateways)."
Write-Host "All data (DynamoDB, Cognito, Secrets, ECR) is preserved."
Write-Host ""
$confirm = Read-Host "Type YES to continue"
if ($confirm -ne "YES") { Write-Host "Aborted."; exit 0 }

# Step 1: Delete k8s workloads gracefully
Write-Host ""
Write-Host "-- Checking kubectl context..."
$ctx = kubectl config current-context 2>&1
if ($LASTEXITCODE -eq 0 -and $ctx -like "*valuepilot*") {
    Write-Host "-- Deleting Kubernetes workloads..."
    kubectl delete deployment --all -n valuepilot --ignore-not-found 2>&1 | Out-Null
    kubectl delete service --all -n valuepilot --ignore-not-found 2>&1 | Out-Null
    Write-Host "OK Workloads deleted"
} else {
    Write-Host "-- kubectl not configured for this cluster, skipping workload cleanup"
}

# Step 2: Kill any active port-forwards
Write-Host "-- Stopping port-forwards..."
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
Write-Host "OK Port-forwards cleared"

# Step 3: Delete EKS stack (cluster + nodes + NAT GWs)
Write-Host ""
Write-Host "-- Deleting EKS stack (this takes ~5 minutes)..."
aws cloudformation delete-stack `
    --stack-name "valuepilot-eks-$Env" `
    --region $Region 2>&1

Write-Host "-- Waiting for EKS stack deletion..."
aws cloudformation wait stack-delete-complete `
    --stack-name "valuepilot-eks-$Env" `
    --region $Region 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Stack deletion may still be in progress. Check AWS Console."
} else {
    Write-Host "OK EKS stack deleted"
}

# Summary
Write-Host ""
Write-Host "========================================="
Write-Host "  Paused! Estimated savings: ~`$133/month"
Write-Host ""
Write-Host "  Still running (low cost):"
Write-Host "    DynamoDB tables     ~`$1/mo"
Write-Host "    Cognito user pool   free tier"
Write-Host "    Secrets Manager     ~`$3/mo"
Write-Host "    ECR images          <`$1/mo"
Write-Host "    VPC (no NAT GWs)    free"
Write-Host ""
Write-Host "  To resume: .\cloudformation\resume.ps1"
Write-Host "========================================="
