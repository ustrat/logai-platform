from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from src.api.inference import router as inference_router

app = FastAPI(
    title="LogAI ML Service",
    description="Bank transaction anomaly detection, pattern recognition & recommendations",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inference_router, prefix="/api/v1/inference")

@app.on_event("startup")
def startup():
    logger.info("Data service ready.")

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "logai-ml-service",
        "data_source": "csv",
        "version": "2.0.0",
    }