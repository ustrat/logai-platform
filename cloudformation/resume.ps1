# ValuePilot - Resume script
# Restores compute (EKS) and redeploys all Kubernetes workloads.
# Counterpart to: .\cloudformation\pause.ps1

param(
    [string]$Env    = "production",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

function Deploy-Stack {
    param([string]$StackName, [string]$Template, [string[]]$ExtraParams = @())
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
    if ($LASTEXITCODE -ne 0) { Write-Error "FAILED: $StackName"; exit 1 }
    Write-Host "OK $StackName"
}

$Dir = $PSScriptRoot

Write-Host ""
Write-Host "========================================="
Write-Host "  ValuePilot - Resume"
Write-Host "  Environment : $Env"
Write-Host "  Region      : $Region"
Write-Host "  ETA         : ~15 minutes"
Write-Host "========================================="

# Step 1: EKS cluster + IRSA + node group
Write-Host ""
Write-Host "-- Deploying EKS stack (cluster takes ~12 min)..."
Deploy-Stack "valuepilot-eks-$Env" "$Dir\eks.yaml"

# Step 2: Configure kubectl
Write-Host ""
Write-Host "-- Configuring kubectl..."
aws eks update-kubeconfig --name "valuepilot-$Env" --region $Region 2>&1
if ($LASTEXITCODE -ne 0) { Write-Error "kubectl config failed"; exit 1 }
Write-Host "OK kubectl configured"

# Step 3: Wait for nodes to be Ready
Write-Host ""
Write-Host "-- Waiting for nodes to be Ready..."
$attempts = 0
do {
    Start-Sleep -Seconds 15
    $ready = kubectl get nodes --no-headers 2>&1 | Select-String " Ready "
    $attempts++
    Write-Host "   Attempt $attempts - $($ready.Count) node(s) ready"
} while ($ready.Count -lt 1 -and $attempts -lt 20)

if ($ready.Count -lt 1) { Write-Error "Nodes did not become ready in time"; exit 1 }
Write-Host "OK Nodes ready"

# Step 4: Apply Kubernetes manifests
Write-Host ""
Write-Host "-- Applying Kubernetes manifests..."
$k8sDir = Join-Path (Split-Path $Dir -Parent) "k8s"
kubectl apply -f "$k8sDir\namespace.yaml"      2>&1
kubectl apply -f "$k8sDir\serviceaccount.yaml" 2>&1
kubectl apply -f "$k8sDir\api.yaml"            2>&1
kubectl apply -f "$k8sDir\web.yaml"            2>&1
kubectl apply -f "$k8sDir\ml-service.yaml"     2>&1
Write-Host "OK Manifests applied"

# Step 5: Wait for pods
Write-Host ""
Write-Host "-- Waiting for pods to be Running (up to 3 min)..."
kubectl rollout status deployment/logai-api        -n valuepilot --timeout=180s 2>&1
kubectl rollout status deployment/logai-web        -n valuepilot --timeout=180s 2>&1
kubectl rollout status deployment/logai-ml-service -n valuepilot --timeout=180s 2>&1

# Step 6: Start port-forward
Write-Host ""
Write-Host "-- Starting port-forward on localhost:3000..."
Start-Process powershell -ArgumentList "-NoProfile -Command `"kubectl port-forward -n valuepilot svc/logai-web 3000:80`"" -WindowStyle Minimized

# Summary
Write-Host ""
Write-Host "========================================="
Write-Host "  ValuePilot is running!"
Write-Host ""
Write-Host "  Web app  : http://localhost:3000"
Write-Host "  Login    : admin@logai.dev / ValuePilot2026!"
Write-Host ""
Write-Host "  To pause again: .\cloudformation\pause.ps1"
Write-Host "========================================="
