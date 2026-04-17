"""
Lambda handler — price_shock event (severity: high)
Triggered when a subscription has a price delta > $500.
"""
import json
import os
import boto3
from datetime import datetime
from typing import Any, Dict

sns = boto3.client("sns")
ALERT_TOPIC_ARN = os.environ.get("ALERT_TOPIC_ARN", "")
PRICE_DELTA_THRESHOLD = float(os.environ.get("PRICE_DELTA_THRESHOLD", "500"))


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Expected event payload:
    {
        "account_id": "ACC-001",
        "subscription_id": "SUB-001",
        "price_delta": 750.00,
        "current_plan": 2000.00,
        "expected_amount": 2750.00,
        "provider": "HubSpot",
        "segment": "SMB"
    }
    """
    try:
        records = _parse_records(event)
        processed = []

        for record in records:
            account_id = record.get("account_id", "UNKNOWN")
            price_delta = float(record.get("price_delta", 0))
            subscription_id = record.get("subscription_id", "")
            current_plan = float(record.get("current_plan", 0))
            expected_amount = float(record.get("expected_amount", 0))
            provider = record.get("provider", "")

            if abs(price_delta) <= PRICE_DELTA_THRESHOLD:
                processed.append({"account_id": account_id, "skipped": True, "reason": f"|price_delta| {abs(price_delta)} <= threshold {PRICE_DELTA_THRESHOLD}"})
                continue

            direction = "increase" if price_delta > 0 else "decrease"
            alert_message = {
                "event": "price_shock",
                "severity": "high",
                "account_id": account_id,
                "subscription_id": subscription_id,
                "price_delta": price_delta,
                "price_change_direction": direction,
                "current_plan_usd": current_plan,
                "expected_amount_usd": expected_amount,
                "provider": provider,
                "recommended_action": "Consider negotiation or price adjustment to prevent churn.",
                "timestamp": datetime.utcnow().isoformat(),
            }

            if ALERT_TOPIC_ARN:
                sns.publish(
                    TopicArn=ALERT_TOPIC_ARN,
                    Subject=f"[HIGH] Price shock on {account_id} — ${price_delta:+,.0f} {direction}",
                    Message=json.dumps(alert_message, indent=2),
                    MessageAttributes={
                        "severity": {"DataType": "String", "StringValue": "high"},
                        "event_type": {"DataType": "String", "StringValue": "price_shock"},
                    },
                )

            processed.append({"account_id": account_id, "alerted": True, "price_delta": price_delta, "direction": direction})

        return {
            "statusCode": 200,
            "body": json.dumps({"event": "price_shock", "processed": len(processed), "results": processed}),
        }

    except Exception as exc:
        print(f"[price_shock] ERROR: {exc}")
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
