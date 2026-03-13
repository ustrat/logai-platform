from elasticsearch import Elasticsearch, AsyncElasticsearch
from loguru import logger
from datetime import datetime, timedelta
from typing import Optional
from src.config import settings
from src.schemas.transaction import Transaction


class ElasticsearchService:
    def __init__(self):
        self.client = Elasticsearch(
            settings.es_host,
            basic_auth=(settings.es_username, settings.es_password),
            verify_certs=False,
        )
        self.index = settings.es_index

    def health_check(self) -> bool:
        try:
            return self.client.ping()
        except Exception as e:
            logger.error(f"Elasticsearch health check failed: {e}")
            return False

    def fetch_transactions(
        self,
        account_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 1000,
    ) -> list[dict]:
        """Fetch raw transaction logs from Elasticsearch."""
        must_clauses = []

        if account_id:
            must_clauses.append({"term": {"account_id.keyword": account_id}})

        if start_date or end_date:
            date_range = {}
            if start_date:
                date_range["gte"] = start_date.isoformat()
            if end_date:
                date_range["lte"] = end_date.isoformat()
            must_clauses.append({"range": {"timestamp": date_range}})

        query = {
            "query": {"bool": {"must": must_clauses}} if must_clauses else {"match_all": {}},
            "sort": [{"timestamp": {"order": "desc"}}],
            "size": limit,
        }

        try:
            response = self.client.search(index=self.index, body=query)
            hits = response["hits"]["hits"]
            logger.info(f"Fetched {len(hits)} transactions from Elasticsearch")
            return [hit["_source"] for hit in hits]
        except Exception as e:
            logger.error(f"Failed to fetch transactions: {e}")
            raise

    def fetch_account_history(self, account_id: str, days: int = 90) -> list[dict]:
        """Fetch full account history for pattern analysis."""
        start_date = datetime.utcnow() - timedelta(days=days)
        return self.fetch_transactions(
            account_id=account_id,
            start_date=start_date,
            limit=10000,
        )

    def fetch_recent_transactions(self, hours: int = 1) -> list[dict]:
        """Fetch recent transactions for real-time anomaly detection."""
        start_date = datetime.utcnow() - timedelta(hours=hours)
        return self.fetch_transactions(start_date=start_date, limit=5000)


es_service = ElasticsearchService()
