from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import traceback

from ..services.csv_data_service import (
    get_transactions,
    get_feature_matrix,
    get_accounts,
    get_summary_stats,
    reload_csv,
)
from ..models.anomaly_detector import AnomalyDetector
from ..models.pattern_recognizer import PatternRecognizer
from ..models.recommendation_engine import RecommendationEngine

router = APIRouter()

# Shared model instances
anomaly_detector = AnomalyDetector()
pattern_recognizer = PatternRecognizer()
recommendation_engine = RecommendationEngine()


class AnalyzeRequest(BaseModel):
    account_id: Optional[str] = None
    limit: Optional[int] = 500


class TrainRequest(BaseModel):
    limit: Optional[int] = 10000


@router.post("/train")
def train_model(req: TrainRequest):
    try:
        X = get_feature_matrix(limit=req.limit)
        if len(X) == 0:
            raise ValueError("No data available for training")
        anomaly_detector.fit(X)
        return {
            "status": "trained",
            "samples": len(X),
            "model_version": "2.0.0-csv",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
def analyze_transactions(req: AnalyzeRequest):
    try:
        if not anomaly_detector.is_fitted:
            # Auto-train on first use
            X = get_feature_matrix(limit=10000)
            anomaly_detector.fit(X)

        transactions = get_transactions(
            account_id=req.account_id,
            limit=req.limit or 500,
        )

        if not transactions:
            raise HTTPException(status_code=404, detail="No transactions found for this account")

        # Build feature matrix for these transactions
        import numpy as np
        feature_keys = [
            "amount", "expected_amount", "current_plan", "price_delta",
            "usage_change_pct", "risk_score", "confidence_score",
            "days_to_renewal", "days_to_cancellation",
            "evidence_required", "evidence_received", "escalation_level",
        ]
        X = np.array([[t.get(k, 0) for k in feature_keys] for t in transactions], dtype=np.float32)

        # Anomaly detection
        anomaly_results = anomaly_detector.predict_with_scores(X)

        # Enrich transactions with anomaly info
        enriched = []
        for i, txn in enumerate(transactions):
            score = float(anomaly_results["scores"][i])
            is_anomaly = bool(anomaly_results["labels"][i])

            reasons = []
            if txn["risk_score"] > 0.75:
                reasons.append(f"High risk score: {txn['risk_score']:.0%}")
            if txn["price_delta"] > 500:
                reasons.append(f"Large price delta: ${txn['price_delta']:,.0f}")
            if txn["usage_change_pct"] < -50:
                reasons.append(f"Significant usage drop: {txn['usage_change_pct']}%")
            if txn["days_to_renewal"] <= 7:
                reasons.append(f"Renewal imminent: {txn['days_to_renewal']} days")
            if txn["days_to_cancellation"] <= 3:
                reasons.append(f"Cancellation deadline critical: {txn['days_to_cancellation']} days")
            if txn["escalation_level"] >= 3:
                reasons.append(f"High escalation level: {txn['escalation_level']}")

            enriched.append({
                **txn,
                "anomaly_score": score,
                "is_anomaly": is_anomaly,
                "reasons": reasons,
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
    req = AnalyzeRequest(account_id=account_id, limit=200)
    result = analyze_transactions(req)
    flagged = [t for t in result["anomalies"] if t["is_anomaly"]]
    return {
        "account_id": account_id,
        "flagged_count": len(flagged),
        "anomalies": flagged,
    }


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
    """Force reload CSV from disk."""
    try:
        df_info = reload_csv()
        return {"status": "reloaded", "message": "CSV data reloaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))