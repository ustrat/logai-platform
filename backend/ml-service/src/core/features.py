import pandas as pd
import numpy as np
from datetime import datetime


def build_features(transactions: list[dict]) -> pd.DataFrame:
    """
    Convert raw transaction logs into ML-ready feature matrix.
    """
    if not transactions:
        return pd.DataFrame()

    df = pd.DataFrame(transactions)

    # ── Parse timestamps ──────────────────────────────────────
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
    df["is_night"] = df["hour"].between(0, 6).astype(int)

    # ── Amount features ───────────────────────────────────────
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
    df["log_amount"] = np.log1p(df["amount"])
    df["is_round_amount"] = (df["amount"] % 100 == 0).astype(int)

    # ── Encode transaction type ───────────────────────────────
    type_map = {"debit": 0, "credit": 1, "transfer": 2, "withdrawal": 3}
    df["transaction_type_enc"] = df.get("transaction_type", pd.Series()).map(type_map).fillna(-1)

    # ── Per-account velocity features (last N transactions) ───
    df = df.sort_values(["account_id", "timestamp"])
    df["prev_amount"] = df.groupby("account_id")["amount"].shift(1).fillna(0)
    df["amount_delta"] = df["amount"] - df["prev_amount"]
    df["time_since_last_txn"] = (
        df.groupby("account_id")["timestamp"]
        .diff()
        .dt.total_seconds()
        .fillna(0)
    )

    # ── Rolling stats per account (7-transaction window) ──────
    grouped = df.groupby("account_id")["amount"]
    df["rolling_mean_7"] = grouped.transform(lambda x: x.rolling(7, min_periods=1).mean())
    df["rolling_std_7"] = grouped.transform(lambda x: x.rolling(7, min_periods=1).std().fillna(0))
    df["amount_zscore"] = (
        (df["amount"] - df["rolling_mean_7"]) / (df["rolling_std_7"] + 1e-9)
    )

    # ── Status encoding ───────────────────────────────────────
    status_map = {"completed": 0, "pending": 1, "failed": 2, "reversed": 3}
    df["status_enc"] = df.get("status", pd.Series()).map(status_map).fillna(-1)

    return df


FEATURE_COLUMNS = [
    "log_amount",
    "hour",
    "day_of_week",
    "is_weekend",
    "is_night",
    "is_round_amount",
    "transaction_type_enc",
    "amount_delta",
    "time_since_last_txn",
    "rolling_mean_7",
    "rolling_std_7",
    "amount_zscore",
    "status_enc",
]


def get_feature_matrix(df: pd.DataFrame) -> np.ndarray:
    """Extract feature columns as numpy array for model input."""
    available = [c for c in FEATURE_COLUMNS if c in df.columns]
    return df[available].fillna(0).values
