"""
Lambda handler — usage_decline event (severity: medium)
Triggered when a subscription shows > 50% usage decline.
"""
import json
import os
import boto3
from datetime import datetime
from typing import Any, Dict

sns = boto3.client("sns")
ALERT_TOPIC_ARN = os.environ.get("ALERT_TOPIC_ARN", "")
USAGE_DROP_THRESHOLD = float(os.environ.get("USAGE_DROP_THRESHOLD", "-50"))


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Expected event payload:
    {
        "account_id": "ACC-001",
        "subscription_id": "SUB-001",
        "usage_change_pct": -65.0,
        "provider": "Zendesk",
        "segment": "Enterprise",
        "amount": 8000.00
    }
    """
    try:
        records = _parse_records(event)
        processed = []

        for record in records:
            account_id = record.get("account_id", "UNKNOWN")
            usage_change_pct = float(record.get("usage_change_pct", 0))
            subscription_id = record.get("subscription_id", "")
            provider = record.get("provider", "")
            segment = record.get("segment", "")
            amount = float(record.get("amount", 0))

            if usage_change_pct >= USAGE_DROP_THRESHOLD:
                processed.append({"account_id": account_id, "skipped": True, "reason": f"usage_change_pct {usage_change_pct} >= threshold {USAGE_DROP_THRESHOLD}"})
                continue

            alert_message = {
                "event": "usage_decline",
                "severity": "medium",
                "account_id": account_id,
                "subscription_id": subscription_id,
                "usage_change_pct": usage_change_pct,
                "provider": provider,
                "segment": segment,
                "amount_at_risk": amount,
                "recommended_action": "Engage customers with re-onboarding or feature education.",
                "timestamp": datetime.utcnow().isoformat(),
            }

            if ALERT_TOPIC_ARN:
                sns.publish(
                    TopicArn=ALERT_TOPIC_ARN,
                    Subject=f"[MEDIUM] Usage decline {usage_change_pct:.0f}% on {account_id}",
                    Message=json.dumps(alert_message, indent=2),
                    MessageAttributes={
                        "severity": {"DataType": "String", "StringValue": "medium"},
                        "event_type": {"DataType": "String", "StringValue": "usage_decline"},
                    },
                )

            processed.append({"account_id": account_id, "alerted": True, "usage_change_pct": usage_change_pct})

        return {
            "statusCode": 200,
            "body": json.dumps({"event": "usage_decline", "processed": len(processed), "results": processed}),
        }

    except Exception as exc:
        print(f"[usage_decline] ERROR: {exc}")
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
