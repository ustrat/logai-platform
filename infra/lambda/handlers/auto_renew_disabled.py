"""
Lambda handler — auto_renew_disabled event (severity: low)
Triggered when a subscription has auto-renew turned off.
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
        "auto_renew": "N",
        "days_to_renewal": 30,
        "provider": "Workday",
        "segment": "SMB",
        "amount": 3500.00
    }
    """
    try:
        records = _parse_records(event)
        processed = []

        for record in records:
            account_id = record.get("account_id", "UNKNOWN")
            auto_renew = str(record.get("auto_renew", "Y")).upper().strip()
            subscription_id = record.get("subscription_id", "")
            days_to_renewal = int(record.get("days_to_renewal", 0))
            provider = record.get("provider", "")
            segment = record.get("segment", "")
            amount = float(record.get("amount", 0))

            if auto_renew != "N":
                processed.append({"account_id": account_id, "skipped": True, "reason": "auto_renew is enabled"})
                continue

            alert_message = {
                "event": "auto_renew_disabled",
                "severity": "low",
                "account_id": account_id,
                "subscription_id": subscription_id,
                "auto_renew": auto_renew,
                "days_to_renewal": days_to_renewal,
                "provider": provider,
                "segment": segment,
                "amount_at_risk": amount,
                "recommended_action": "Proactively contact customers to enable auto-renewal.",
                "timestamp": datetime.utcnow().isoformat(),
            }

            if ALERT_TOPIC_ARN:
                sns.publish(
                    TopicArn=ALERT_TOPIC_ARN,
                    Subject=f"[LOW] Auto-renew disabled for {account_id} — {days_to_renewal} days to renewal",
                    Message=json.dumps(alert_message, indent=2),
                    MessageAttributes={
                        "severity": {"DataType": "String", "StringValue": "low"},
                        "event_type": {"DataType": "String", "StringValue": "auto_renew_disabled"},
                    },
                )

            processed.append({"account_id": account_id, "alerted": True, "days_to_renewal": days_to_renewal})

        return {
            "statusCode": 200,
            "body": json.dumps({"event": "auto_renew_disabled", "processed": len(processed), "results": processed}),
        }

    except Exception as exc:
        print(f"[auto_renew_disabled] ERROR: {exc}")
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
