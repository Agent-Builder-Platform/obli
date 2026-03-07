from fastapi import APIRouter, Depends
from middleware.auth import get_current_user
from services.ai_providers import SUPPORTED_MODELS

router = APIRouter()


@router.get("/")
async def list_models(current_user: dict = Depends(get_current_user)):
    """Return all supported AI models grouped by provider."""
    grouped = {}
    for model in SUPPORTED_MODELS:
        provider = model["provider"]
        if provider not in grouped:
            grouped[provider] = []
        grouped[provider].append(model)

    return {
        "models": SUPPORTED_MODELS,
        "grouped": grouped,
        "total": len(SUPPORTED_MODELS),
    }