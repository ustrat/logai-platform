import pytest
import numpy as np
from datetime import datetime, timedelta
from src.core.features import build_features, get_feature_matrix
from src.models.anomaly_detector import AnomalyDetector
from src.models.pattern_recognizer import PatternRecognizer
from src.models.recommendation_engine import RecommendationEngine
from src.schemas.transaction import AnomalyResult, PatternResult


def make_transactions(n: int = 100) -> list[dict]:
    """Generate synthetic transaction data for testing."""
    import random
    random.seed(42)
    txns = []
    base_time = datetime.utcnow() - timedelta(days=30)
    for i in range(n):
        txns.append({
            "transaction_id": f"txn_{i}",
            "account_id": "acc_001" if i % 3 != 0 else "acc_002",
            "amount": random.gauss(500, 200) if i < n - 5 else random.uniform(9000, 15000),
            "currency": "USD",
            "transaction_type": random.choice(["debit", "credit", "transfer"]),
            "merchant_category": random.choice(["groceries", "dining", "travel", "retail"]),
            "timestamp": (base_time + timedelta(hours=i * 7)).isoformat(),
            "status": "completed",
        })
    return txns


# ── Feature engineering ───────────────────────────────────────
class TestFeatureEngineering:
    def test_build_features_returns_dataframe(self):
        df = build_features(make_transactions(50))
        assert not df.empty

    def test_expected_columns_present(self):
        df = build_features(make_transactions(50))
        for col in ["log_amount", "hour", "is_weekend", "amount_zscore"]:
            assert col in df.columns, f"Missing column: {col}"

    def test_feature_matrix_no_nan(self):
        df = build_features(make_transactions(50))
        X = get_feature_matrix(df)
        assert not np.isnan(X).any()

    def test_empty_input(self):
        df = build_features([])
        assert df.empty


# ── Anomaly detection ─────────────────────────────────────────
class TestAnomalyDetector:
    def test_train_and_predict(self):
        detector = AnomalyDetector()
        txns = make_transactions(200)
        detector.train(txns)
        results = detector.predict(txns[:10])
        assert len(results) == 10
        for r in results:
            assert 0.0 <= r.anomaly_score <= 1.0

    def test_high_amount_flagged(self):
        detector = AnomalyDetector()
        txns = make_transactions(200)
        detector.train(txns)
        # inject obvious anomaly
        anomalous = txns[:1]
        anomalous[0]["amount"] = 999999
        results = detector.predict(anomalous)
        assert results[0].is_anomaly or results[0].anomaly_score > 0.5

    def test_empty_input_returns_empty(self):
        detector = AnomalyDetector()
        assert detector.predict([]) == []


# ── Pattern recognition ───────────────────────────────────────
class TestPatternRecognizer:
    def test_returns_pattern_result(self):
        recognizer = PatternRecognizer()
        result = recognizer.analyze(make_transactions(50), "acc_001")
        assert isinstance(result, PatternResult)
        assert result.total_transactions > 0

    def test_patterns_list_not_empty(self):
        recognizer = PatternRecognizer()
        result = recognizer.analyze(make_transactions(100), "acc_001")
        assert len(result.patterns) > 0


# ── Recommendations ───────────────────────────────────────────
class TestRecommendationEngine:
    def test_critical_anomaly_triggers_recommendation(self):
        engine = RecommendationEngine()
        anomalies = [
            AnomalyResult(transaction_id="t1", is_anomaly=True, anomaly_score=0.92, reasons=["test"]),
        ]
        recs = engine.generate("acc_001", anomalies, None)
        assert any(r.severity == "critical" for r in recs)

    def test_no_anomalies_no_fraud_rec(self):
        engine = RecommendationEngine()
        anomalies = [
            AnomalyResult(transaction_id="t1", is_anomaly=False, anomaly_score=0.1),
        ]
        recs = engine.generate("acc_001", anomalies, None)
        assert not any(r.category == "fraud" for r in recs)
