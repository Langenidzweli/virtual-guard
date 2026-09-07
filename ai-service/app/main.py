from fastapi import FastAPI
from fastapi.responses import JSONResponse
from app.api import routes

app = FastAPI(
    title="Virtual Guard AI Service",
    description="AI Service for video analysis",
    version="1.0.0"
)

app.include_router(routes.router)

@app.get("/health")
async def health_check():
    behaviour_ready = routes.behaviour_analyzer.model is not None and routes.behaviour_analyzer.scaler is not None
    payload = {
        "status": "healthy" if behaviour_ready else "degraded",
        "service": "ai-service",
        "behaviour_model_ready": behaviour_ready,
    }
    if not behaviour_ready:
        return JSONResponse(status_code=503, content=payload)
    return payload
