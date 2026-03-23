from typing import List, Dict, Any


class RecommendationEngine:
    def generate(self, transactions: List[Dict], patterns: Dict) -> List[Dict]:
        recommendations = []

        # Critical risk — imminent cancellation deadlines
        critical = [t for t in transactions if t.get("days_to_cancellation", 99) <= 3]
        if critical:
            recommendations.append({
                "severity": "critical",
                "category": "Cancellation Deadline",
                "message": f"{len(critical)} subscription(s) have cancellation deadlines within 3 days.",
                "recommended_action": "Immediate outreach required. Escalate to account manager.",
                "confidence": 0.99,
                "affected_accounts": [t["account_id"] for t in critical[:5]],
            })

        # High risk score accounts
        high_risk = [t for t in transactions if t.get("risk_score", 0) > 0.75]
        if high_risk:
            total_at_risk = sum(t.get("amount", 0) for t in high_risk)
            recommendations.append({
                "severity": "high",
                "category": "High Risk Accounts",
                "message": f"{len(high_risk)} accounts have risk score >75%. Total exposure: ${total_at_risk:,.0f}.",
                "recommended_action": "Review recommended strategies and apply retention offers.",
                "confidence": 0.92,
                "affected_accounts": [t["account_id"] for t in high_risk[:5]],
            })

        # Large price deltas
        price_shock = [t for t in transactions if abs(t.get("price_delta", 0)) > 500]
        if price_shock:
            recommendations.append({
                "severity": "high",
                "category": "Price Shock",
                "message": f"{len(price_shock)} subscriptions have price delta >$500.",
                "recommended_action": "Consider negotiation or price adjustment to prevent churn.",
                "confidence": 0.87,
                "affected_accounts": [t["account_id"] for t in price_shock[:5]],
            })

        # Usage drops
        usage_drop = [t for t in transactions if t.get("usage_change_pct", 0) < -50]
        if usage_drop:
            recommendations.append({
                "severity": "medium",
                "category": "Usage Decline",
                "message": f"{len(usage_drop)} subscriptions show >50% usage decline.",
                "recommended_action": "Engage customers with re-onboarding or feature education.",
                "confidence": 0.81,
                "affected_accounts": [t["account_id"] for t in usage_drop[:5]],
            })

        # Pending approvals
        pending = [t for t in transactions if t.get("approval_status", "").lower() == "pending"]
        if pending:
            recommendations.append({
                "severity": "medium",
                "category": "Pending Approvals",
                "message": f"{len(pending)} cases are awaiting approval.",
                "recommended_action": "Clear approval queue to unblock renewal actions.",
                "confidence": 0.95,
                "affected_accounts": [t["account_id"] for t in pending[:5]],
            })

        # Missing evidence
        missing_evidence = [
            t for t in transactions
            if t.get("evidence_required", 0) > t.get("evidence_received", 0)
        ]
        if missing_evidence:
            recommendations.append({
                "severity": "medium",
                "category": "Incomplete Evidence",
                "message": f"{len(missing_evidence)} cases have missing evidence submissions.",
                "recommended_action": "Follow up with customers to collect required documentation.",
                "confidence": 0.88,
                "affected_accounts": [t["account_id"] for t in missing_evidence[:5]],
            })

        # Auto-renew disabled
        no_auto = [t for t in transactions if str(t.get("auto_renew", "N")).upper() == "N"]
        if no_auto:
            recommendations.append({
                "severity": "low",
                "category": "Auto-Renew Disabled",
                "message": f"{len(no_auto)} subscriptions have auto-renew turned off.",
                "recommended_action": "Proactively contact customers to enable auto-renewal.",
                "confidence": 0.75,
                "affected_accounts": [t["account_id"] for t in no_auto[:5]],
            })

        # Sort by severity
        order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        recommendations.sort(key=lambda r: order.get(r["severity"], 99))

        return recommendations