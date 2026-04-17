"""
Lambda handler — high_risk_accounts event (severity: high)
Triggered when an account has a risk score > 0.75 (75%).
"""
import json
import os
import boto3
from datetime import datetime
from typing import Any, Dict

sns = boto3.client("sns")
ALERT_TOPIC_ARN = os.environ.get("ALERT_TOPIC_ARN", "")
RISK_THRESHOLD = float(os.environ.get("RISK_THRESHOLD", "0.75"))


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Expected event payload:
    {
        "account_id": "ACC-001",
        "subscription_id": "SUB-001",
        "risk_score": 0.88,
        "amount": 12000.00,
        "provider": "Salesforce",
        "segment": "Mid-Market",
        "strategy": "Retention Offer"
    }
    """
    try:
        records = _parse_records(event)
        processed = []
        total_exposure = 0.0

        for record in records:
            account_id = record.get("account_id", "UNKNOWN")
            risk_score = float(record.get("risk_score", 0))
            amount = float(record.get("amount", 0))
            subscription_id = record.get("subscription_id", "")
            provider = record.get("provider", "")
            strategy = record.get("strategy", "")

            if risk_score <= RISK_THRESHOLD:
                processed.append({"account_id": account_id, "skipped": True, "reason": f"risk_score {risk_score} <= threshold {RISK_THRESHOLD}"})
                continue

            total_exposure += amount

            alert_message = {
                "event": "high_risk_accounts",
                "severity": "high",
                "account_id": account_id,
                "subscription_id": subscription_id,
                "risk_score": risk_score,
                "amount_at_risk": amount,
                "provider": provider,
                "recommended_strategy": strategy,
                "recommended_action": "Review recommended strategies and apply retention offers.",
                "timestamp": datetime.utcnow().isoformat(),
            }

            if ALERT_TOPIC_ARN:
                sns.publish(
                    TopicArn=ALERT_TOPIC_ARN,
                    Subject=f"[HIGH] High-risk account {account_id} — risk score {risk_score:.0%}",
                    Message=json.dumps(alert_message, indent=2),
                    MessageAttributes={
                        "severity": {"DataType": "String", "StringValue": "high"},
                        "event_type": {"DataType": "String", "StringValue": "high_risk_accounts"},
                    },
                )

            processed.append({"account_id": account_id, "alerted": True, "risk_score": risk_score, "amount": amount})

        return {
            "statusCode": 200,
            "body": json.dumps({
                "event": "high_risk_accounts",
                "processed": len(processed),
                "total_exposure_usd": total_exposure,
                "results": processed,
            }),
        }

    except Exception as exc:
        print(f"[high_risk_accounts] ERROR: {exc}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(exc)}),
        }


def _parse_records(event: Dict[str, Any]):
    if "Records" in event:
        records = []
        for r in event["Records"]:
            body = r.get("body", "{}")
            records.append(json.loads(body) if isinstance(body, str) else body)
        return records
    if "detail" in event:
        return [event["detail"]]
    if isinstance(event, list):
        return event
    return [event]
