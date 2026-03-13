import random
import uuid
import numpy as np
from datetime import datetime, timedelta
from loguru import logger


# ── Realistic data pools ──────────────────────────────────────
MERCHANT_CATEGORIES = [
    "groceries", "dining", "travel", "retail", "utilities",
    "healthcare", "entertainment", "fuel", "online_shopping", "atm_withdrawal",
]

MERCHANTS = {
    "groceries":       ["Walmart", "Kroger", "Whole Foods", "Aldi", "Publix"],
    "dining":          ["McDonald's", "Starbucks", "Chipotle", "Olive Garden", "DoorDash"],
    "travel":          ["Delta Airlines", "Marriott", "Airbnb", "Uber", "Hertz"],
    "retail":          ["Amazon", "Target", "Best Buy", "Nike", "Macy's"],
    "utilities":       ["AT&T", "Comcast", "Georgia Power", "City Water", "Gas Co"],
    "healthcare":      ["CVS Pharmacy", "Walgreens", "Quest Diagnostics", "BlueCross"],
    "entertainment":   ["Netflix", "Spotify", "AMC Theaters", "Steam", "PlayStation"],
    "fuel":            ["Shell", "BP", "Chevron", "ExxonMobil", "Circle K"],
    "online_shopping": ["eBay", "Etsy", "Shopify Store", "AliExpress", "Wayfair"],
    "atm_withdrawal":  ["ATM Withdrawal", "Cash Advance"],
}

TRANSACTION_TYPES = ["debit", "credit", "transfer", "withdrawal"]
STATUSES = ["completed", "completed", "completed", "pending", "failed", "reversed"]
LOCATIONS = [
    "Atlanta, GA", "New York, NY", "Chicago, IL", "Houston, TX",
    "Los Angeles, CA", "Miami, FL", "Dallas, TX", "Seattle, WA",
]


class SyntheticDataService:
    """
    Generates realistic synthetic bank transaction logs.
    Drops in as a replacement for ElasticsearchService during development.
    Injects anomalies so the ML models have something meaningful to detect.
    """

    def __init__(self, seed: int = 42):
        random.seed(seed)
        np.random.seed(seed)
        self._accounts = self._generate_account_profiles()

    # ── Account profiles ──────────────────────────────────────
    def _generate_account_profiles(self) -> dict:
        """Each account has its own spending behaviour."""
        profiles = {}
        for i in range(1, 11):
            account_id = f"ACC-{i:04d}"
            profiles[account_id] = {
                "avg_spend":   random.uniform(50, 800),
                "std_spend":   random.uniform(20, 200),
                "peak_hour":   random.randint(8, 20),
                "primary_location": random.choice(LOCATIONS),
                "preferred_categories": random.sample(MERCHANT_CATEGORIES, k=4),
            }
        return profiles

    # ── Core generator ────────────────────────────────────────
    def _make_transaction(
        self,
        account_id: str,
        timestamp: datetime,
        force_anomaly: bool = False,
    ) -> dict:
        profile = self._accounts.get(account_id, list(self._accounts.values())[0])

        if force_anomaly:
            amount = round(random.uniform(8000, 25000), 2)
            category = random.choice(["atm_withdrawal", "travel", "online_shopping"])
            hour = random.randint(0, 5)          # night transaction
            location = random.choice([l for l in LOCATIONS if l != profile["primary_location"]])
            status = random.choice(["completed", "failed", "reversed"])
        else:
            amount = max(1.0, round(np.random.normal(profile["avg_spend"], profile["std_spend"]), 2))
            category = random.choice(profile["preferred_categories"])
            hour = int(np.clip(np.random.normal(profile["peak_hour"], 3), 0, 23))
            location = profile["primary_location"]
            status = random.choices(STATUSES, weights=[70, 10, 10, 5, 3, 2])[0]

        txn_time = timestamp.replace(hour=hour, minute=random.randint(0, 59))
        merchant = random.choice(MERCHANTS.get(category, ["Unknown"]))

        return {
            "transaction_id":    str(uuid.uuid4()),
            "account_id":        account_id,
            "amount":            amount,
            "currency":          "USD",
            "transaction_type":  random.choice(TRANSACTION_TYPES),
            "merchant_category": category,
            "merchant_name":     merchant,
            "location":          location,
            "timestamp":         txn_time.isoformat(),
            "status":            status,
            "ip_address":        f"192.168.{random.randint(0,255)}.{random.randint(0,255)}",
            "device_id":         f"DEV-{random.randint(1000, 9999)}",
        }

    def _inject_velocity_burst(self, account_id: str, base_time: datetime) -> list[dict]:
        """Simulate card-testing: many small transactions within seconds."""
        burst = []
        for i in range(random.randint(6, 12)):
            txn = self._make_transaction(account_id, base_time)
            txn["amount"] = round(random.uniform(0.50, 5.00), 2)
            # override timestamp to be within a few seconds
            txn["timestamp"] = (base_time + timedelta(seconds=i * 3)).isoformat()
            burst.append(txn)
        return burst

    # ── Public API — mirrors ElasticsearchService interface ───
    def fetch_transactions(
        self,
        account_id: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        limit: int = 1000,
    ) -> list[dict]:
        end = end_date or datetime.utcnow()
        start = start_date or (end - timedelta(days=90))
        accounts = [account_id] if account_id else list(self._accounts.keys())

        transactions = []
        day_range = (end - start).days or 1
        txns_per_account = max(10, limit // len(accounts))

        for acc in accounts:
            for _ in range(txns_per_account):
                day_offset = random.randint(0, day_range)
                ts = start + timedelta(days=day_offset)
                transactions.append(self._make_transaction(acc, ts))

        # Inject anomalies (~5%)
        anomaly_count = max(1, len(transactions) // 20)
        for _ in range(anomaly_count):
            acc = random.choice(accounts)
            ts = start + timedelta(days=random.randint(0, day_range))
            transactions.append(self._make_transaction(acc, ts, force_anomaly=True))

        # Inject 1–2 velocity bursts
        for _ in range(random.randint(1, 2)):
            acc = random.choice(accounts)
            ts = start + timedelta(days=random.randint(0, day_range))
            transactions.extend(self._inject_velocity_burst(acc, ts))

        random.shuffle(transactions)
        transactions = transactions[:limit]
        logger.info(f"Generated {len(transactions)} synthetic transactions")
        return transactions

    def fetch_account_history(self, account_id: str, days: int = 90) -> list[dict]:
        start = datetime.utcnow() - timedelta(days=days)
        return self.fetch_transactions(account_id=account_id, start_date=start, limit=10000)

    def fetch_recent_transactions(self, hours: int = 1) -> list[dict]:
        start = datetime.utcnow() - timedelta(hours=hours)
        return self.fetch_transactions(start_date=start, limit=500)

    def health_check(self) -> bool:
        return True   # always healthy — no external dependency


# ── Singleton ─────────────────────────────────────────────────
data_service = SyntheticDataService()