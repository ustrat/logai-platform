from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import traceback

from ..services.csv_data_service import (
    get_transactions,
    get_feature_matrix,
    get_accounts,
    get_summary_stats,
    reload_csv,
)
from ..models.anomaly_detector import anomaly_detector
from ..models.pattern_recognizer import PatternRecognizer
from ..models.recommendation_engine import RecommendationEngine

router = APIRouter()

pattern_recognizer = PatternRecognizer()
recommendation_engine = RecommendationEngine()


def _normalize_plaid(txns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Map Plaid transaction fields to the internal ML schema."""
    out = []
    for t in txns:
        out.append({
            "transaction_id":              t.get("transaction_id", ""),
            "account_id":                  t.get("account_id", "unknown"),
            "customer_id":                 t.get("account_id", "unknown"),
            "subscription_id":             t.get("transaction_id", ""),
            "projected_charge_usd":        abs(float(t.get("amount", 0))),
            "expected_charge_usd":         abs(float(t.get("amount", 0))),
            "current_plan_amount_usd":     abs(float(t.get("amount", 0))),
            "price_delta_usd":             0.0,
            "usage_change_pct":            0.0,
            "risk_score":                  0.0,
            "confidence_score":            1.0,
            "days_to_renewal":             30,
            "days_to_cancellation_deadline": 30,
            "escalation_level":            0,
            "provider_name":               t.get("merchant_name") or t.get("name", "Unknown"),
            "provider_category":           (t.get("category") or ["Other"])[0] if isinstance(t.get("category"), list) else t.get("category", "Other"),
            "customer_segment":            "standard",
            "severity":                    "low",
            "event_name":                  t.get("name", ""),
            "event_date":                  t.get("date", ""),
            "recommended_strategy":        "monitor",
            "action_status":               "pending",
            "approval_status":             "approved",
            "auto_renew_flag":             "Y",
            "eligibility_status":          "eligible",
            "state_code":                  t.get("location", {}).get("region", "Unknown") if isinstance(t.get("location"), dict) else "Unknown",
            "country_code":                "US",
            "pending":                     t.get("pending", False),
            "payment_channel":             t.get("payment_channel", "other"),
        })
    return out


class AnalyzeRequest(BaseModel):
    account_id: Optional[str] = None
    limit: Optional[int] = 500
    transactions: Optional[List[Dict[str, Any]]] = None


class TrainRequest(BaseModel):
    limit: Optional[int] = 10000


def _is_model_trained() -> bool:
    """Check if the anomaly detector has been trained."""
    try:
        anomaly_detector.model.predict([[0] * 12])
        return True
    except Exception:
        return False


@router.post("/train")
def train_model(req: TrainRequest = TrainRequest()):
    try:
        transactions = get_transactions(limit=req.limit or 10000)
        if not transactions:
            raise ValueError("No training data available in CSV")

        result = anomaly_detector.train(transactions)
        return {
            "status": result.get("status", "trained"),
            "samples": result.get("samples", len(transactions)),
            "model_version": result.get("model_version", "2.0.0-csv"),
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
def analyze_transactions(req: AnalyzeRequest = AnalyzeRequest()):
    try:
        # Use injected transactions (e.g. from Plaid) if provided, otherwise fall back to CSV
        if req.transactions:
            transactions = _normalize_plaid(req.transactions)[:(req.limit or 500)]
        else:
            transactions = get_transactions(
                account_id=req.account_id if req.account_id and req.account_id != "ALL" else None,
                limit=req.limit or 500,
            )

        if not transactions:
            raise HTTPException(status_code=404, detail="No transactions found")

        # Auto-train if model not fitted
        if not _is_model_trained():
            all_transactions = get_transactions(limit=10000)
            anomaly_detector.train(all_transactions)

        # Run anomaly detection using existing predict method
        anomaly_results = anomaly_detector.predict(transactions)

        # Build result map by transaction_id
        result_map = {r.transaction_id: r for r in anomaly_results}

        # Enrich transactions with anomaly data
        enriched = []
        for txn in transactions:
            txn_id = str(txn.get("transaction_id", ""))
            result = result_map.get(txn_id)

            if result:
                score = result.anomaly_score
                is_anomaly = result.is_anomaly
                reasons = list(result.reasons)
            else:
                score = 0.0
                is_anomaly = False
                reasons = []

            # Add domain-specific reasons from CSV fields
            if txn.get("risk_score", 0) > 0.75:
                reasons.append(f"High risk score: {txn['risk_score']:.0%}")
            if abs(txn.get("price_delta", 0)) > 500:
                reasons.append(f"Large price delta: ${abs(txn['price_delta']):,.0f}")
            if txn.get("usage_change_pct", 0) < -50:
                reasons.append(f"Significant usage drop: {txn['usage_change_pct']}%")
            if txn.get("days_to_renewal", 99) <= 7:
                reasons.append(f"Renewal imminent: {txn['days_to_renewal']} days")
            if txn.get("days_to_cancellation", 99) <= 3:
                reasons.append(f"Cancellation deadline critical: {txn['days_to_cancellation']} days")
            if txn.get("escalation_level", 0) >= 3:
                reasons.append(f"High escalation level: {txn['escalation_level']}")

            enriched.append({
                **txn,
                "anomaly_score": score,
                "is_anomaly": is_anomaly,
                "reasons": list(set(reasons)),
            })

        # Pattern recognition
        patterns = pattern_recognizer.analyze(transactions)

        # Recommendations
        recommendations = recommendation_engine.generate(enriched, patterns)

        return {
            "account_id": req.account_id or "ALL",
            "transactions_analyzed": len(transactions),
            "anomalies": enriched,
            "patterns": patterns,
            "recommendations": recommendations,
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anomalies/{account_id}")
def get_account_anomalies(account_id: str):
    try:
        req = AnalyzeRequest(account_id=account_id, limit=200)
        result = analyze_transactions(req)
        flagged = [t for t in result["anomalies"] if t["is_anomaly"]]
        return {
            "account_id": account_id,
            "flagged_count": len(flagged),
            "anomalies": flagged,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accounts")
def list_accounts():
    try:
        accounts = get_accounts()
        return {"accounts": accounts, "count": len(accounts)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
def data_summary():
    try:
        return get_summary_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reload")
def reload_data():
    try:
        reload_csv()
        return {"status": "reloaded", "message": "CSV data reloaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))