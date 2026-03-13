import numpy as np
import pandas as pd
import joblib
import os
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from loguru import logger

from src.config import settings
from src.core.features import build_features, get_feature_matrix
from src.schemas.transaction import AnomalyResult


MODEL_FILE = os.path.join(settings.model_path, "anomaly_detector.pkl")
SCALER_FILE = os.path.join(settings.model_path, "anomaly_scaler.pkl")
MODEL_VERSION = "1.0.0"


class AnomalyDetector:
    def __init__(self):
        self.model: IsolationForest | None = None
        self.scaler: StandardScaler | None = None
        self._load_or_init()

    def _load_or_init(self):
        """Load saved model or initialise a fresh one."""
        if os.path.exists(MODEL_FILE) and os.path.exists(SCALER_FILE):
            self.model = joblib.load(MODEL_FILE)
            self.scaler = joblib.load(SCALER_FILE)
            logger.info("Anomaly detection model loaded from disk.")
        else:
            logger.warning("No saved model found — initialising untrained model.")
            self.model = IsolationForest(
                n_estimators=200,
                contamination=0.05,   # expect ~5% anomalies in bank transactions
                random_state=42,
                n_jobs=-1,
            )
            self.scaler = StandardScaler()

    def train(self, transactions: list[dict]) -> dict:
        """Train the anomaly detector on historical transactions."""
        logger.info(f"Training anomaly detector on {len(transactions)} transactions...")

        df = build_features(transactions)
        X = get_feature_matrix(df)

        if len(X) < 50:
            raise ValueError("Need at least 50 transactions to train the model.")

        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled)

        os.makedirs(settings.model_path, exist_ok=True)
        joblib.dump(self.model, MODEL_FILE)
        joblib.dump(self.scaler, SCALER_FILE)

        logger.info("Anomaly detector trained and saved.")
        return {"status": "trained", "samples": len(X), "model_version": MODEL_VERSION}

    def predict(self, transactions: list[dict]) -> list[AnomalyResult]:
        """Score transactions — returns anomaly results for each."""
        if not transactions:
            return []

        df = build_features(transactions)
        X = get_feature_matrix(df)
        X_scaled = self.scaler.transform(X)

        # Isolation Forest: -1 = anomaly, 1 = normal
        raw_scores = self.model.decision_function(X_scaled)  # lower = more anomalous
        predictions = self.model.predict(X_scaled)

        # Normalise scores to 0–1 (1 = most anomalous)
        normalised = 1 - (raw_scores - raw_scores.min()) / (raw_scores.ptp() + 1e-9)

        results = []
        for i, row in df.iterrows():
            idx = df.index.get_loc(i)
            score = float(normalised[idx])
            is_anomaly = (
                predictions[idx] == -1
                or score >= settings.anomaly_threshold
            )
            reasons = self._explain(row, score)

            results.append(AnomalyResult(
                transaction_id=str(row.get("transaction_id", i)),
                is_anomaly=is_anomaly,
                anomaly_score=round(score, 4),
                reasons=reasons,
            ))

        return results

    def _explain(self, row: pd.Series, score: float) -> list[str]:
        """Generate human-readable reasons for a high anomaly score."""
        reasons = []
        if row.get("amount", 0) > settings.alert_high_amount:
            reasons.append(f"High transaction amount: ${row['amount']:,.2f}")
        if abs(row.get("amount_zscore", 0)) > 3:
            reasons.append("Amount is >3 std deviations from account average")
        if row.get("is_night", 0):
            reasons.append("Transaction occurred between midnight and 6am")
        if row.get("time_since_last_txn", 9999) < 30:
            reasons.append("Multiple transactions within 30 seconds")
        if row.get("is_round_amount", 0) and row.get("amount", 0) >= 1000:
            reasons.append("Suspiciously round large amount")
        if score >= settings.anomaly_threshold and not reasons:
            reasons.append("Unusual combination of transaction features")
        return reasons


anomaly_detector = AnomalyDetector()
