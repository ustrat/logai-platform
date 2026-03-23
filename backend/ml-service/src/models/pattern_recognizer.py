from typing import List, Dict, Any
from collections import Counter
import numpy as np


class PatternRecognizer:
    def analyze(self, transactions: List[Dict]) -> Dict:
        if not transactions:
            return {"patterns": [], "summary": {}}

        patterns = []

        # Provider concentration
        providers = Counter(t.get("provider", "Unknown") for t in transactions)
        top_provider = providers.most_common(1)[0]
        patterns.append({
            "type": "provider_concentration",
            "top_provider": top_provider[0],
            "count": top_provider[1],
            "pct": round(top_provider[1] / len(transactions) * 100, 1),
        })

        # Segment distribution
        segments = Counter(t.get("segment", "Unknown") for t in transactions)
        patterns.append({
            "type": "segment_distribution",
            **{k: v for k, v in segments.most_common(5)},
        })

        # Strategy distribution
        strategies = Counter(t.get("strategy", "Unknown") for t in transactions)
        patterns.append({
            "type": "recommended_strategies",
            **{k: v for k, v in strategies.most_common(5)},
        })

        # Renewal urgency
        urgent = len([t for t in transactions if t.get("days_to_renewal", 999) <= 7])
        upcoming = len([t for t in transactions if 7 < t.get("days_to_renewal", 999) <= 30])
        patterns.append({
            "type": "renewal_urgency",
            "urgent_within_7_days": urgent,
            "upcoming_within_30_days": upcoming,
            "total": len(transactions),
        })

        # Average financials
        amounts = [t.get("amount", 0) for t in transactions]
        deltas = [t.get("price_delta", 0) for t in transactions]
        patterns.append({
            "type": "financial_summary",
            "avg_projected_charge": round(float(np.mean(amounts)), 2),
            "total_projected_charge": round(float(np.sum(amounts)), 2),
            "avg_price_delta": round(float(np.mean(deltas)), 2),
            "total_price_delta": round(float(np.sum(deltas)), 2),
        })

        # Escalation distribution
        esc_levels = Counter(t.get("escalation_level", 0) for t in transactions)
        patterns.append({
            "type": "escalation_levels",
            **{f"level_{k}": v for k, v in sorted(esc_levels.items())},
        })

        return {
            "patterns": patterns,
            "summary": {
                "total_analyzed": len(transactions),
                "unique_providers": len(providers),
                "unique_segments": len(segments),
            }
        }