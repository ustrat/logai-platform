"""
Lambda handler — pending_approvals event (severity: medium)
Triggered when cases are awaiting approval.
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
        "approval_status": "pending",
        "escalation_level": 2,
        "provider": "ServiceNow",
        "segment": "Enterprise",
        "amount": 15000.00
    }
    """
    try:
        records = _parse_records(event)
        processed = []

        for record in records:
            account_id = record.get("account_id", "UNKNOWN")
            approval_status = str(record.get("approval_status", "")).lower()
            subscription_id = record.get("subscription_id", "")
            escalation_level = int(record.get("escalation_level", 0))
            provider = record.get("provider", "")
            amount = float(record.get("amount", 0))

            if approval_status != "pending":
                processed.append({"account_id": account_id, "skipped": True, "reason": f"approval_status is '{approval_status}', not 'pending'"})
                continue

            alert_message = {
                "event": "pending_approvals",
                "severity": "medium",
                "account_id": account_id,
                "subscription_id": subscription_id,
                "approval_status": approval_status,
                "escalation_level": escalation_level,
                "provider": provider,
                "amount_at_risk": amount,
                "recommended_action": "Clear approval queue to unblock renewal actions.",
                "timestamp": datetime.utcnow().isoformat(),
            }

            if ALERT_TOPIC_ARN:
                sns.publish(
                    TopicArn=ALERT_TOPIC_ARN,
                    Subject=f"[MEDIUM] Pending approval for {account_id} (escalation level {escalation_level})",
                    Message=json.dumps(alert_message, indent=2),
                    MessageAttributes={
                        "severity": {"DataType": "String", "StringValue": "medium"},
                        "event_type": {"DataType": "String", "StringValue": "pending_approvals"},
                    },
                )

            processed.append({"account_id": account_id, "alerted": True, "escalation_level": escalation_level})

        return {
            "statusCode": 200,
            "body": json.dumps({"event": "pending_approvals", "processed": len(processed), "results": processed}),
        }

    except Exception as exc:
        print(f"[pending_approvals] ERROR: {exc}")
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
