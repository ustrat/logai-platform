import pandas as pd
import numpy as np
from loguru import logger
from src.core.features import build_features
from src.schemas.transaction import PatternResult


class PatternRecognizer:

    def analyze(self, transactions: list[dict], account_id: str) -> PatternResult:
        """Identify behavioural patterns in an account's transaction history."""
        df = build_features(transactions)

        if df.empty:
            return PatternResult(
                account_id=account_id,
                patterns=[],
                analysis_window_days=0,
                total_transactions=0,
            )

        patterns = []
        patterns.extend(self._spending_patterns(df))
        patterns.extend(self._time_patterns(df))
        patterns.extend(self._velocity_patterns(df))
        patterns.extend(self._merchant_patterns(df))

        window_days = 0
        if "timestamp" in df.columns and len(df) > 1:
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            delta = df["timestamp"].max() - df["timestamp"].min()
            window_days = delta.days

        logger.info(f"Found {len(patterns)} patterns for account {account_id}")
        return PatternResult(
            account_id=account_id,
            patterns=patterns,
            analysis_window_days=window_days,
            total_transactions=len(df),
        )

    # ── Spending patterns ─────────────────────────────────────
    def _spending_patterns(self, df: pd.DataFrame) -> list[dict]:
        patterns = []
        if "amount" not in df.columns:
            return patterns

        avg = df["amount"].mean()
        std = df["amount"].std()
        total = df["amount"].sum()

        patterns.append({
            "type": "spending_summary",
            "avg_transaction": round(avg, 2),
            "std_transaction": round(std, 2),
            "total_volume": round(total, 2),
            "max_transaction": round(df["amount"].max(), 2),
        })

        # Detect large outlier transactions
        outliers = df[df["amount"] > avg + 2 * std]
        if not outliers.empty:
            patterns.append({
                "type": "large_outlier_transactions",
                "count": len(outliers),
                "avg_outlier_amount": round(outliers["amount"].mean(), 2),
                "transaction_ids": outliers.get("transaction_id", pd.Series()).tolist()[:10],
            })

        return patterns

    # ── Time-based patterns ───────────────────────────────────
    def _time_patterns(self, df: pd.DataFrame) -> list[dict]:
        patterns = []
        if "hour" not in df.columns:
            return patterns

        peak_hour = int(df["hour"].mode()[0])
        peak_day = int(df["day_of_week"].mode()[0]) if "day_of_week" in df.columns else None
        night_txns = df[df["is_night"] == 1] if "is_night" in df.columns else pd.DataFrame()

        patterns.append({
            "type": "time_behaviour",
            "peak_hour": peak_hour,
            "peak_day_of_week": peak_day,
            "night_transaction_count": len(night_txns),
            "night_transaction_pct": round(len(night_txns) / max(len(df), 1) * 100, 1),
        })

        return patterns

    # ── Velocity patterns ─────────────────────────────────────
    def _velocity_patterns(self, df: pd.DataFrame) -> list[dict]:
        patterns = []
        if "time_since_last_txn" not in df.columns:
            return patterns

        rapid = df[df["time_since_last_txn"] < 60]  # < 60 seconds apart
        if not rapid.empty:
            patterns.append({
                "type": "rapid_transaction_bursts",
                "burst_count": len(rapid),
                "description": "Transactions occurring within 60 seconds of each other",
            })

        return patterns

    # ── Merchant patterns ─────────────────────────────────────
    def _merchant_patterns(self, df: pd.DataFrame) -> list[dict]:
        patterns = []
        if "merchant_category" not in df.columns:
            return patterns

        top_categories = (
            df["merchant_category"]
            .dropna()
            .value_counts()
            .head(5)
            .to_dict()
        )
        if top_categories:
            patterns.append({
                "type": "top_merchant_categories",
                "categories": top_categories,
            })

        return patterns


pattern_recognizer = PatternRecognizer()
