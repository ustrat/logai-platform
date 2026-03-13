from loguru import logger
from src.schemas.transaction import AnomalyResult, PatternResult, Recommendation
from src.config import settings


class RecommendationEngine:

    def generate(
        self,
        account_id: str,
        anomalies: list[AnomalyResult],
        patterns: PatternResult | None,
    ) -> list[Recommendation]:
        """Generate actionable recommendations from anomalies and patterns."""
        recommendations = []

        recommendations.extend(self._from_anomalies(account_id, anomalies))
        if patterns:
            recommendations.extend(self._from_patterns(account_id, patterns))

        # Sort by severity
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        recommendations.sort(key=lambda r: severity_order.get(r.severity, 9))

        logger.info(f"Generated {len(recommendations)} recommendations for account {account_id}")
        return recommendations

    # ── Anomaly-based recommendations ────────────────────────
    def _from_anomalies(
        self, account_id: str, anomalies: list[AnomalyResult]
    ) -> list[Recommendation]:
        recs = []
        flagged = [a for a in anomalies if a.is_anomaly]

        if not flagged:
            return recs

        critical = [a for a in flagged if a.anomaly_score >= 0.85]
        high = [a for a in flagged if 0.7 <= a.anomaly_score < 0.85]
        medium = [a for a in flagged if a.anomaly_score < 0.7]

        if critical:
            recs.append(Recommendation(
                account_id=account_id,
                severity="critical",
                category="fraud",
                message=(
                    f"{len(critical)} transaction(s) show critical anomaly scores "
                    f"(≥0.85). Immediate review required."
                ),
                transaction_ids=[a.transaction_id for a in critical],
                recommended_action="Freeze account and trigger fraud review workflow.",
                confidence=round(sum(a.anomaly_score for a in critical) / len(critical), 2),
            ))

        if high:
            recs.append(Recommendation(
                account_id=account_id,
                severity="high",
                category="unusual_pattern",
                message=(
                    f"{len(high)} transaction(s) have high anomaly scores (0.70–0.85). "
                    f"Manual investigation recommended."
                ),
                transaction_ids=[a.transaction_id for a in high],
                recommended_action="Flag for manual review and notify risk team.",
                confidence=round(sum(a.anomaly_score for a in high) / len(high), 2),
            ))

        if medium:
            recs.append(Recommendation(
                account_id=account_id,
                severity="medium",
                category="unusual_pattern",
                message=f"{len(medium)} transaction(s) show mildly unusual behaviour.",
                transaction_ids=[a.transaction_id for a in medium],
                recommended_action="Monitor account for further unusual activity.",
                confidence=round(sum(a.anomaly_score for a in medium) / len(medium), 2),
            ))

        return recs

    # ── Pattern-based recommendations ────────────────────────
    def _from_patterns(
        self, account_id: str, patterns: PatternResult
    ) -> list[Recommendation]:
        recs = []

        for pattern in patterns.patterns:
            ptype = pattern.get("type")

            if ptype == "rapid_transaction_bursts":
                count = pattern.get("burst_count", 0)
                if count > 5:
                    recs.append(Recommendation(
                        account_id=account_id,
                        severity="high",
                        category="velocity",
                        message=(
                            f"{count} rapid back-to-back transactions detected "
                            f"(within 60 seconds). Common indicator of card testing."
                        ),
                        recommended_action="Enable velocity controls and alert account holder.",
                        confidence=0.80,
                    ))

            if ptype == "time_behaviour":
                night_pct = pattern.get("night_transaction_pct", 0)
                if night_pct > 30:
                    recs.append(Recommendation(
                        account_id=account_id,
                        severity="medium",
                        category="unusual_pattern",
                        message=(
                            f"{night_pct}% of transactions occur between midnight and 6am, "
                            f"which is above expected behaviour."
                        ),
                        recommended_action="Review night-time transaction activity with account holder.",
                        confidence=0.65,
                    ))

            if ptype == "large_outlier_transactions":
                count = pattern.get("count", 0)
                avg = pattern.get("avg_outlier_amount", 0)
                if count > 0:
                    recs.append(Recommendation(
                        account_id=account_id,
                        severity="medium",
                        category="high_value",
                        message=(
                            f"{count} transaction(s) significantly exceed this account's "
                            f"normal spend (avg outlier: ${avg:,.2f})."
                        ),
                        transaction_ids=pattern.get("transaction_ids", []),
                        recommended_action="Verify large transactions with account holder.",
                        confidence=0.72,
                    ))

        return recs


recommendation_engine = RecommendationEngine()
