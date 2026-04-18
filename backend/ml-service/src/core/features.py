import pandas as pd
import numpy as np


def build_features(transactions: list[dict]) -> pd.DataFrame:
    """
    Convert raw transaction logs into ML-ready feature matrix.
    Compatible with both legacy synthetic data and new CSV renewal data.
    """
    if not transactions:
        return pd.DataFrame()

    df = pd.DataFrame(transactions)

    # ── Normalize timestamp field ─────────────────────────────
    # Support both 'timestamp' (legacy) and 'event_date'/'event_timestamp' (CSV)
    if "timestamp" not in df.columns:
        if "event_timestamp" in df.columns:
            df["timestamp"] = pd.to_datetime(df["event_timestamp"], errors="coerce")
        elif "event_date" in df.columns:
            df["timestamp"] = pd.to_datetime(df["event_date"], errors="coerce")
        else:
            df["timestamp"] = pd.Timestamp.now()
    else:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

    df["timestamp"] = df["timestamp"].fillna(pd.Timestamp.now())
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
    df["is_night"] = df["hour"].between(0, 6).astype(int)

    # ── Normalize amount field ────────────────────────────────
    # Support 'amount' (legacy) and 'projected_charge_usd' (CSV)
    if "amount" not in df.columns:
        if "projected_charge_usd" in df.columns:
            df["amount"] = pd.to_numeric(df["projected_charge_usd"], errors="coerce").fillna(0)
        else:
            df["amount"] = 0.0
    else:
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)

    df["log_amount"] = np.log1p(df["amount"].abs())
    df["is_round_amount"] = (df["amount"] % 100 == 0).astype(int)

    # ── Normalize account_id field ────────────────────────────
    if "account_id" not in df.columns:
        df["account_id"] = "default"
    else:
        df["account_id"] = df["account_id"].fillna("default").astype(str)

    # ── Encode transaction/event type ─────────────────────────
    if "transaction_type" in df.columns:
        type_map = {"debit": 0, "credit": 1, "transfer": 2, "withdrawal": 3}
        df["transaction_type_enc"] = df["transaction_type"].map(type_map).fillna(-1)
    elif "event_name" in df.columns:
        # Map event names to numeric codes
        events = df["event_name"].unique()
        event_map = {e: i for i, e in enumerate(events)}
        df["transaction_type_enc"] = df["event_name"].map(event_map).fillna(-1)
    else:
        df["transaction_type_enc"] = -1

    # ── Per-account velocity features ────────────────────────
    df = df.sort_values(["account_id", "timestamp"])
    df["prev_amount"] = df.groupby("account_id")["amount"].shift(1).fillna(0)
    df["amount_delta"] = df["amount"] - df["prev_amount"]
    df["time_since_last_txn"] = (
        df.groupby("account_id")["timestamp"]
        .diff()
        .dt.total_seconds()
        .fillna(0)
    )

    # ── Rolling stats per account ─────────────────────────────
    grouped = df.groupby("account_id")["amount"]
    df["rolling_mean_7"] = grouped.transform(lambda x: x.rolling(7, min_periods=1).mean())
    df["rolling_std_7"] = grouped.transform(lambda x: x.rolling(7, min_periods=1).std().fillna(0))
    df["amount_zscore"] = (
        (df["amount"] - df["rolling_mean_7"]) / (df["rolling_std_7"] + 1e-9)
    )

    # ── CSV-specific risk features ────────────────────────────
    if "risk_score" in df.columns:
        df["risk_score_norm"] = pd.to_numeric(df["risk_score"], errors="coerce").fillna(0) / 100.0
    else:
        df["risk_score_norm"] = 0.0

    if "price_delta_usd" in df.columns:
        df["price_delta_norm"] = pd.to_numeric(df["price_delta_usd"], errors="coerce").fillna(0)
    elif "price_delta" in df.columns:
        df["price_delta_norm"] = pd.to_numeric(df["price_delta"], errors="coerce").fillna(0)
    else:
        df["price_delta_norm"] = 0.0

    if "days_to_renewal" in df.columns:
        df["days_to_renewal_norm"] = pd.to_numeric(df["days_to_renewal"], errors="coerce").fillna(30)
    else:
        df["days_to_renewal_norm"] = 30.0

    if "escalation_level" in df.columns:
        df["escalation_norm"] = pd.to_numeric(df["escalation_level"], errors="coerce").fillna(0)
    else:
        df["escalation_norm"] = 0.0

    # ── Status encoding ───────────────────────────────────────
    if "status" in df.columns:
        status_map = {"completed": 0, "pending": 1, "failed": 2, "reversed": 3}
        df["status_enc"] = df["status"].map(status_map).fillna(-1)
    elif "action_status" in df.columns:
        statuses = df["action_status"].unique()
        status_map2 = {s: i for i, s in enumerate(statuses)}
        df["status_enc"] = df["action_status"].map(status_map2).fillna(-1)
    else:
        df["status_enc"] = -1

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
    "risk_score_norm",
    "price_delta_norm",
    "days_to_renewal_norm",
    "escalation_norm",
]


def get_feature_matrix(df: pd.DataFrame) -> np.ndarray:
    """Extract feature columns as numpy array for model input."""
    available = [c for c in FEATURE_COLUMNS if c in df.columns]
    return df[available].fillna(0).values