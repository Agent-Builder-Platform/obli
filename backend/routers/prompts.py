from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from middleware.auth import get_current_user
from services.supabase_client import supabase

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class PromptCreate(BaseModel):
    name: str
    content: str
    visibility: str = 'private'


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    visibility: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_prompts(current_user: dict = Depends(get_current_user)):
    """List all system prompts for the current user."""
    user_id = current_user["sub"]
    response = (
        supabase.table("system_prompts")
        .select("*")
        .or_(f"user_id.eq.{user_id},visibility.eq.public,visibility.eq.team")
        .order("created_at", desc=True)
        .execute()
    )
    return {"prompts": response.data, "total": len(response.data)}


@router.post("/", status_code=201)
async def create_prompt(
    prompt: PromptCreate, current_user: dict = Depends(get_current_user)
):
    """Create a new system prompt."""
    user_id = current_user["sub"]
    data = {
        "user_id": user_id,
        "name": prompt.name,
        "content": prompt.content,
        "visibility": prompt.visibility,
    }
    response = supabase.table("system_prompts").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create prompt")
    return {"prompt": response.data[0]}


@router.put("/{prompt_id}")
async def update_prompt(
    prompt_id: str,
    prompt: PromptUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a system prompt."""
    user_id = current_user["sub"]
    update_data = {k: v for k, v in prompt.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update fields provided")

    response = (
        supabase.table("system_prompts")
        .update(update_data)
        .eq("id", prompt_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Prompt not found or access denied")
    return {"prompt": response.data[0]}


@router.delete("/{prompt_id}")
async def delete_prompt(
    prompt_id: str, current_user: dict = Depends(get_current_user)
):
    """Delete a system prompt."""
    user_id = current_user["sub"]
    supabase.table("system_prompts").delete().eq("id", prompt_id).eq(
        "user_id", user_id
    ).execute()
    return {"message": "Prompt deleted successfully"}


