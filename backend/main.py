from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import time

load_dotenv()

from routers import agents, models, prompts, chat, waitlist, knowledge

app = FastAPI(
    title="Obli API",
    version="1.0.0",
    description="AI Agent Platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://obli-agent-builder-frontend-prod.onrender.com", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
app.include_router(models.router, prefix="/api/models", tags=["Models"])
app.include_router(prompts.router, prefix="/api/prompts", tags=["System Prompts"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(waitlist.router, prefix="/api/waitlist", tags=["Waitlist"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["Knowledge Base"])


@app.get("/api/health", tags=["Health"])
async def health():
    current_time = time.time()
    return {"status": "ok",
            "service": "obli-api", 
            "version": "1.0.0", 
            "time": current_time}
