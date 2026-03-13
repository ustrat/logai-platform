from fastapi import APIRouter, HTTPException, Query
from loguru import logger
from datetime import datetime
from typing import Optional

from src.services.synthetic_data_service import (
    data_service as es_service,
)  # 🔄 swap import when ELK is ready
from src.models.anomaly_detector import anomaly_detector, MODEL_VERSION
from src.models.pattern_recognizer import pattern_recognizer
from src.models.recommendation_engine import recommendation_engine
from src.schemas.transaction import InferenceRequest, InferenceResponse

router = APIRouter(prefix="/api/v1/inference", tags=["inference"])


@router.post("/analyze", response_model=InferenceResponse)
def analyze_transactions(request: InferenceRequest):
    """
    Full ML pipeline: fetch from ELK → feature engineering →
    anomaly detection → pattern recognition → recommendations.
    """
    try:
        transactions = es_service.fetch_transactions(
            account_id=request.account_id,
            start_date=request.start_date,
            end_date=request.end_date,
            limit=request.limit,
        )
    except Exception as e:
        raise HTTPException(
            status_code=503, detail=f"Failed to fetch from Elasticsearch: {e}"
        )

    if not transactions:
        raise HTTPException(
            status_code=404, detail="No transactions found for given filters."
        )

    anomalies = anomaly_detector.predict(transactions)
    patterns = pattern_recognizer.analyze(
        transactions, account_id=request.account_id or "all"
    )
    recommendations = recommendation_engine.generate(
        account_id=request.account_id or "all",
        anomalies=anomalies,
        patterns=patterns,
    )

    return InferenceResponse(
        account_id=request.account_id,
        anomalies=anomalies,
        patterns=patterns,
        recommendations=recommendations,
        transactions_analyzed=len(transactions),
        model_version=MODEL_VERSION,
    )


@router.post("/train")
def train_model(days: int = Query(default=90, ge=7, le=365)):
    """Retrain the anomaly detection model on recent transaction history."""
    try:
        transactions = es_service.fetch_transactions(
            start_date=datetime.utcnow().__class__.utcnow(),
            limit=50000,
        )
        result = anomaly_detector.train(transactions)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")


@router.get("/anomalies/{account_id}")
def get_account_anomalies(account_id: str, limit: int = Query(default=100, le=1000)):
    """Quick anomaly check for a single account."""
    transactions = es_service.fetch_account_history(account_id, days=30)
    anomalies = anomaly_detector.predict(transactions)
    flagged = [a for a in anomalies if a.is_anomaly]
    return {
        "account_id": account_id,
        "total_analyzed": len(anomalies),
        "anomalies_found": len(flagged),
        "anomalies": flagged[:limit],
    }
