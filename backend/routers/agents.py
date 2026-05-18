from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from middleware.auth import get_current_user
from services.supabase_client import supabase

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class AgentCreate(BaseModel):
    name: str
    model: str
    description: Optional[str] = None
    system_prompt_id: Optional[str] = None
    knowledge_base_ids: List[str] = []
    visibility: str = "private"


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    description: Optional[str] = None
    system_prompt_id: Optional[str] = None
    knowledge_base_ids: Optional[List[str]] = None
    visibility: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_agents(current_user: dict = Depends(get_current_user)):
    """List all agents owned by the current user."""
    user_id = current_user["sub"]
    response = (
        supabase.table("agents")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"agents": response.data, "total": len(response.data)}


@router.post("/", status_code=201)
async def create_agent(agent: AgentCreate, current_user: dict = Depends(get_current_user)):
    """Create a new agent."""
    user_id = current_user["sub"]
    data = {
        "user_id": user_id,
        "name": agent.name,
        "model": agent.model,
        "description": agent.description,
        "system_prompt_id": agent.system_prompt_id,
        "knowledge_base_ids": agent.knowledge_base_ids,
        "visibility": agent.visibility,
    }
    response = supabase.table("agents").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create agent")
    return {"agent": response.data[0]}


@router.get("/{agent_id}")
async def get_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific agent with its system prompts hydrated."""
    user_id = current_user["sub"]
    response = (
        supabase.table("agents").select("*").eq("id", agent_id).single().execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = response.data
    if agent["user_id"] != user_id and agent["visibility"] == "private":
        raise HTTPException(status_code=403, detail="Access denied")

    # Hydrate system prompt (single)
    system_prompt = None
    if agent.get("system_prompt_id"):
        sp_response = (
            supabase.table("system_prompts")
            .select("*")
            .eq("id", agent["system_prompt_id"])
            .limit(1)
            .execute()
        )
        if sp_response.data:
            system_prompt = sp_response.data[0]

    # Hydrate knowledge bases
    knowledge_bases = []
    if agent.get("knowledge_base_ids"):
        kb_response = (
            supabase.table("knowledge_bases")
            .select("*")
            .in_("id", agent["knowledge_base_ids"])
            .execute()
        )
        knowledge_bases = kb_response.data

    return {
        "agent": agent,
        "system_prompt": system_prompt,
        "knowledge_bases": knowledge_bases,
    }


@router.put("/{agent_id}")
async def update_agent(
    agent_id: str,
    agent: AgentUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an agent."""
    user_id = current_user["sub"]
    # exclude_unset preserves explicit None (so users can clear system_prompt_id)
    update_data = agent.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No update fields provided")

    response = (
        supabase.table("agents")
        .update(update_data)
        .eq("id", agent_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Agent not found or access denied")
    return {"agent": response.data[0]}


@router.delete("/{agent_id}", status_code=200)
async def delete_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an agent."""
    user_id = current_user["sub"]
    supabase.table("agents").delete().eq("id", agent_id).eq("user_id", user_id).execute()
    return {"message": "Agent deleted successfully"}