import os
import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Optional

# ── Config ─────────────────────────────────────────────────────────────────
CSV_PATH = os.environ.get(
    "RENEWAL_DATA_PATH",
    r"C:\Users\Camir Inshiqaq\OneDrive\Documents\renewalguard_daily_us_separate_events\merged_all.csv"
)

# ── Column mapping from your CSV to internal schema ────────────────────────
COL_MAP = {
    "transaction_id":   "record_id",
    "account_id":       "account_id",
    "customer_id":      "customer_id",
    "subscription_id":  "subscription_id",
    "amount":           "projected_charge_usd",
    "expected_amount":  "expected_charge_usd",
    "current_plan":     "current_plan_amount_usd",
    "price_delta":      "price_delta_usd",
    "usage_change":     "usage_change_pct",
    "risk_score":       "risk_score",
    "confidence":       "confidence_score",
    "days_to_renewal":  "days_to_renewal",
    "days_to_cancel":   "days_to_cancellation_deadline",
    "provider":         "provider_name",
    "category":         "provider_category",
    "segment":          "customer_segment",
    "severity":         "severity",
    "event_name":       "event_name",
    "event_date":       "event_date",
    "strategy":         "recommended_strategy",
    "action_status":    "action_status",
    "approval_status":  "approval_status",
    "escalation_level": "escalation_level",
    "auto_renew":       "auto_renew_flag",
    "eligibility":      "eligibility_status",
    "state":            "state_code",
    "country":          "country_code",
    "screen_presentation": "screen_presentation",
}

# ── Cache loaded data ───────────────────────────────────────────────────────
_df_cache: Optional[pd.DataFrame] = None

def _load_csv() -> pd.DataFrame:
    global _df_cache
    if _df_cache is not None:
        return _df_cache

    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(
            f"CSV not found at: {CSV_PATH}\n"
            f"Set RENEWAL_DATA_PATH env var to override."
        )

    df = pd.read_csv(CSV_PATH, low_memory=False)

    # Normalize column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # Parse dates safely
    for col in ["event_date", "renewal_date", "cancellation_deadline"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    # Ensure numeric columns
    for col in ["projected_charge_usd", "expected_charge_usd", "current_plan_amount_usd",
                "price_delta_usd", "usage_change_pct", "risk_score", "confidence_score",
                "days_to_renewal", "days_to_cancellation_deadline",
                "evidence_required_count", "evidence_received_count", "escalation_level"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Fill missing string cols
    for col in ["account_id", "customer_id", "subscription_id", "provider_name",
                "provider_category", "customer_segment", "severity", "event_name",
                "recommended_strategy", "action_status", "approval_status",
                "auto_renew_flag", "eligibility_status", "state_code", "country_code"]:
        if col in df.columns:
            df[col] = df[col].fillna("Unknown").astype(str)

    _df_cache = df
    print(f"[DataService] Loaded {len(df)} records from CSV")
    return df


def reload_csv():
    """Force reload from disk."""
    global _df_cache
    _df_cache = None
    return _load_csv()


def get_accounts() -> List[str]:
    df = _load_csv()
    return sorted(df["account_id"].unique().tolist())


def get_transactions(
    account_id: Optional[str] = None,
    limit: int = 500,
) -> List[Dict[str, Any]]:
    df = _load_csv()

    if account_id and account_id != "ALL":
        df = df[df["account_id"] == account_id]

    df = df.head(limit)

    records = []
    for _, row in df.iterrows():
        records.append({
            "transaction_id":       str(row.get("record_id", row.get("case_id", ""))),
            "account_id":           str(row.get("account_id", "")),
            "customer_id":          str(row.get("customer_id", "")),
            "subscription_id":      str(row.get("subscription_id", "")),
            "amount":               float(row.get("projected_charge_usd", 0)),
            "expected_amount":      float(row.get("expected_charge_usd", 0)),
            "current_plan":         float(row.get("current_plan_amount_usd", 0)),
            "price_delta":          float(row.get("price_delta_usd", 0)),
            "usage_change_pct":     float(row.get("usage_change_pct", 0)),
            "risk_score":           float(row.get("risk_score", 0)) / 100.0,  # normalize to 0-1
            "confidence_score":     float(row.get("confidence_score", 0)),
            "days_to_renewal":      int(row.get("days_to_renewal", 0)),
            "days_to_cancellation": int(row.get("days_to_cancellation_deadline", 0)),
            "provider":             str(row.get("provider_name", "")),
            "category":             str(row.get("provider_category", "")),
            "segment":              str(row.get("customer_segment", "")),
            "severity":             str(row.get("severity", "")),
            "event_name":           str(row.get("event_name", "")),
            "strategy":             str(row.get("recommended_strategy", "")),
            "action_status":        str(row.get("action_status", "")),
            "approval_status":      str(row.get("approval_status", "")),
            "escalation_level":     int(row.get("escalation_level", 0)),
            "auto_renew":           str(row.get("auto_renew_flag", "N")),
            "eligibility":          str(row.get("eligibility_status", "")),
            "state":                str(row.get("state_code", "")),
            "country":              str(row.get("country_code", "")),
            "screen_presentation":  str(row.get("screen_presentation", "")),
            "evidence_required":    int(row.get("evidence_required_count", 0)),
            "evidence_received":    int(row.get("evidence_received_count", 0)),
        })
    return records


def get_feature_matrix(account_id: Optional[str] = None, limit: int = 10000) -> np.ndarray:
    """Return numeric feature matrix for ML training/inference."""
    df = _load_csv()

    if account_id and account_id != "ALL":
        df = df[df["account_id"] == account_id]

    df = df.head(limit)

    features = [
        "projected_charge_usd",
        "expected_charge_usd",
        "current_plan_amount_usd",
        "price_delta_usd",
        "usage_change_pct",
        "risk_score",
        "confidence_score",
        "days_to_renewal",
        "days_to_cancellation_deadline",
        "evidence_required_count",
        "evidence_received_count",
        "escalation_level",
    ]

    available = [f for f in features if f in df.columns]
    X = df[available].fillna(0).values.astype(np.float32)
    return X


def get_summary_stats() -> Dict[str, Any]:
    df = _load_csv()
    return {
        "total_records":        len(df),
        "unique_accounts":      int(df["account_id"].nunique()),
        "unique_customers":     int(df["customer_id"].nunique()),
        "total_exposure_usd":   float(df["projected_charge_usd"].sum()),
        "avg_risk_score":       float(df["risk_score"].mean()),
        "high_risk_count":      int((df["risk_score"] >= 75).sum()),
        "critical_count":       int((df["severity"].str.lower() == "critical").sum()),
        "providers":            df["provider_name"].value_counts().head(10).to_dict(),
        "segments":             df["customer_segment"].value_counts().to_dict(),
        "strategies":           df["recommended_strategy"].value_counts().to_dict(),
        "action_statuses":      df["action_status"].value_counts().to_dict(),
    }