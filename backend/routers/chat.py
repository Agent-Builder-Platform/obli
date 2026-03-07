from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from middleware.auth import get_current_user
from services.supabase_client import supabase
from services.ai_providers import chat_completion

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class Message(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    agent_id: str
    messages: List[Message]
    conversation_id: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/")
async def send_message(
    request: ChatRequest, current_user: dict = Depends(get_current_user)
):
    """Send a message to an agent and receive a response."""
    user_id = current_user["sub"]

    # Fetch the agent
    agent_res = (
        supabase.table("agents").select("*").eq("id", request.agent_id).single().execute()
    )
    if not agent_res.data:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent = agent_res.data

    # Verify access
    if agent["user_id"] != user_id and agent["visibility"] == "private":
        raise HTTPException(status_code=403, detail="Access denied")

    # Build system prompt from active prompts attached to agent
    combined_system_prompt: Optional[str] = None
    if agent.get("system_prompt_ids"):
        sp_res = (
            supabase.table("system_prompts")
            .select("content, is_active, name")
            .in_("id", agent["system_prompt_ids"])
            .execute()
        )
        active = [p["content"] for p in sp_res.data if p.get("is_active")]
        if active:
            combined_system_prompt = "\n\n---\n\n".join(active)

    # Format messages for the AI provider
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    # Call the AI
    try:
        reply = await chat_completion(
            model_id=agent["model"],
            messages=messages,
            system_prompt=combined_system_prompt,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI provider error: {str(e)}")

    # Persist the conversation
    all_messages = messages + [{"role": "assistant", "content": reply}]

    if request.conversation_id:
        supabase.table("conversations").update(
            {"messages": all_messages}
        ).eq("id", request.conversation_id).eq("user_id", user_id).execute()
        conv_id = request.conversation_id
    else:
        # Auto-title from first user message
        title = messages[0]["content"][:60] + ("..." if len(messages[0]["content"]) > 60 else "")
        conv_res = supabase.table("conversations").insert(
            {
                "user_id": user_id,
                "agent_id": request.agent_id,
                "title": title,
                "messages": all_messages,
            }
        ).execute()
        conv_id = conv_res.data[0]["id"]

    return {
        "response": reply,
        "conversation_id": conv_id,
        "role": "assistant",
    }


@router.get("/conversations/{agent_id}")
async def list_conversations(
    agent_id: str, current_user: dict = Depends(get_current_user)
):
    """List all conversations for a given agent."""
    user_id = current_user["sub"]
    response = (
        supabase.table("conversations")
        .select("id, title, created_at, updated_at")
        .eq("agent_id", agent_id)
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return {"conversations": response.data}


@router.get("/conversation/{conversation_id}")
async def get_conversation(
    conversation_id: str, current_user: dict = Depends(get_current_user)
):
    """Get a full conversation including all messages."""
    user_id = current_user["sub"]
    response = (
        supabase.table("conversations")
        .select("*")
        .eq("id", conversation_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"conversation": response.data}


@router.delete("/conversation/{conversation_id}")
async def delete_conversation(
    conversation_id: str, current_user: dict = Depends(get_current_user)
):
    """Delete a conversation."""
    user_id = current_user["sub"]
    supabase.table("conversations").delete().eq("id", conversation_id).eq(
        "user_id", user_id
    ).execute()
    return {"message": "Conversation deleted"}