"""
Lambda handler — cancellation_deadline event (severity: critical)
Triggered when a subscription has a cancellation deadline within 3 days.
"""
import json
import os
import boto3
from datetime import datetime
from typing import Any, Dict

sns = boto3.client("sns")
ALERT_TOPIC_ARN = os.environ.get("ALERT_TOPIC_ARN", "")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Expected event payload:
    {
        "account_id": "ACC-001",
        "subscription_id": "SUB-001",
        "days_to_cancellation": 2,
        "amount": 5000.00,
        "provider": "AWS",
        "segment": "Enterprise"
    }
    """
    try:
        records = _parse_records(event)
        processed = []

        for record in records:
            account_id = record.get("account_id", "UNKNOWN")
            days = record.get("days_to_cancellation", 0)
            amount = record.get("amount", 0)
            subscription_id = record.get("subscription_id", "")
            provider = record.get("provider", "")

            if days > 3:
                processed.append({"account_id": account_id, "skipped": True, "reason": "deadline > 3 days"})
                continue

            alert_message = {
                "event": "cancellation_deadline",
                "severity": "critical",
                "account_id": account_id,
                "subscription_id": subscription_id,
                "days_to_cancellation": days,
                "amount_at_risk": amount,
                "provider": provider,
                "recommended_action": "Immediate outreach required. Escalate to account manager.",
                "timestamp": datetime.utcnow().isoformat(),
            }

            if ALERT_TOPIC_ARN:
                sns.publish(
                    TopicArn=ALERT_TOPIC_ARN,
                    Subject=f"[CRITICAL] Cancellation deadline in {days} day(s) — {account_id}",
                    Message=json.dumps(alert_message, indent=2),
                    MessageAttributes={
                        "severity": {"DataType": "String", "StringValue": "critical"},
                        "event_type": {"DataType": "String", "StringValue": "cancellation_deadline"},
                    },
                )

            processed.append({"account_id": account_id, "alerted": True, "days_to_cancellation": days})

        return {
            "statusCode": 200,
            "body": json.dumps({"event": "cancellation_deadline", "processed": len(processed), "results": processed}),
        }

    except Exception as exc:
        print(f"[cancellation_deadline] ERROR: {exc}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(exc)}),
        }


def _parse_records(event: Dict[str, Any]):
    """Support both direct payload and SQS/EventBridge envelope."""
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
