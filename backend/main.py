from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

from routers import agents, models, prompts, chat

app = FastAPI(
    title="Obli API",
    version="1.0.0",
    description="AI Agent Platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
app.include_router(models.router, prefix="/api/models", tags=["Models"])
app.include_router(prompts.router, prefix="/api/prompts", tags=["System Prompts"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])


@app.get("/api/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "obli-api", "version": "1.0.0"}
