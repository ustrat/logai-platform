from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Elasticsearch
    es_host: str = "http://localhost:9200"
    es_username: str = "elastic"
    es_password: str = "changeme"
    es_index: str = "bank-transactions-*"

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/logai"
    redis_url: str = "redis://localhost:6379"

    # ML
    model_path: str = "models/saved"
    anomaly_threshold: float = 0.6  # score above this = anomaly
    alert_high_amount: float = 10000  # flag transactions above this

    # Scheduler
    retrain_cron: str = "0 2 * * *"  # retrain models at 2am daily

    class Config:
        env_file = ".env"


settings = Settings()
