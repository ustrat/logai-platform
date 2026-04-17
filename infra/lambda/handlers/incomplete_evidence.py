"""
Lambda handler — incomplete_evidence event (severity: medium)
Triggered when a case has missing evidence submissions.
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
        "evidence_required": 3,
        "evidence_received": 1,
        "provider": "Oracle",
        "segment": "Enterprise",
        "amount": 20000.00
    }
    """
    try:
        records = _parse_records(event)
        processed = []

        for record in records:
            account_id = record.get("account_id", "UNKNOWN")
            evidence_required = int(record.get("evidence_required", 0))
            evidence_received = int(record.get("evidence_received", 0))
            subscription_id = record.get("subscription_id", "")
            provider = record.get("provider", "")
            amount = float(record.get("amount", 0))

            if evidence_required <= evidence_received:
                processed.append({"account_id": account_id, "skipped": True, "reason": "evidence complete"})
                continue

            missing_count = evidence_required - evidence_received
            alert_message = {
                "event": "incomplete_evidence",
                "severity": "medium",
                "account_id": account_id,
                "subscription_id": subscription_id,
                "evidence_required": evidence_required,
                "evidence_received": evidence_received,
                "missing_count": missing_count,
                "provider": provider,
                "amount_at_risk": amount,
                "recommended_action": "Follow up with customers to collect required documentation.",
                "timestamp": datetime.utcnow().isoformat(),
            }

            if ALERT_TOPIC_ARN:
                sns.publish(
                    TopicArn=ALERT_TOPIC_ARN,
                    Subject=f"[MEDIUM] {missing_count} missing evidence item(s) for {account_id}",
                    Message=json.dumps(alert_message, indent=2),
                    MessageAttributes={
                        "severity": {"DataType": "String", "StringValue": "medium"},
                        "event_type": {"DataType": "String", "StringValue": "incomplete_evidence"},
                    },
                )

            processed.append({"account_id": account_id, "alerted": True, "missing_count": missing_count})

        return {
            "statusCode": 200,
            "body": json.dumps({"event": "incomplete_evidence", "processed": len(processed), "results": processed}),
        }

    except Exception as exc:
        print(f"[incomplete_evidence] ERROR: {exc}")
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
