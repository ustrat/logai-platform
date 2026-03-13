from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class Transaction(BaseModel):
    """Raw transaction log from Elasticsearch."""
    transaction_id: str
    account_id: str
    amount: float
    currency: str = "USD"
    transaction_type: str          # debit | credit | transfer | withdrawal
    merchant_category: Optional[str] = None
    merchant_name: Optional[str] = None
    location: Optional[str] = None
    timestamp: datetime
    status: str                    # completed | pending | failed | reversed
    ip_address: Optional[str] = None
    device_id: Optional[str] = None


class AnomalyResult(BaseModel):
    transaction_id: str
    is_anomaly: bool
    anomaly_score: float = Field(..., ge=0.0, le=1.0)
    reasons: list[str] = []


class PatternResult(BaseModel):
    account_id: str
    patterns: list[dict]
    analysis_window_days: int
    total_transactions: int


class Recommendation(BaseModel):
    account_id: str
    severity: str                  # low | medium | high | critical
    category: str                  # fraud | unusual_pattern | high_value | velocity
    message: str
    transaction_ids: list[str] = []
    recommended_action: str
    confidence: float = Field(..., ge=0.0, le=1.0)


class InferenceRequest(BaseModel):
    account_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    limit: int = Field(default=1000, le=10000)


class InferenceResponse(BaseModel):
    account_id: Optional[str]
    anomalies: list[AnomalyResult]
    patterns: Optional[PatternResult]
    recommendations: list[Recommendation]
    transactions_analyzed: int
    model_version: str
