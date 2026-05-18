from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from middleware.auth import get_current_user
from services.supabase_client import supabase
from services.ai_providers import chat_completion
from services.knowledge_base import retrieve_context

RAG_TOP_K = 4

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

    # Resolve the single system prompt attached to the agent (if any).
    user_system_prompt: Optional[str] = None
    if agent.get("system_prompt_id"):
        sp_res = (
            supabase.table("system_prompts")
            .select("content, is_active, name")
            .eq("id", agent["system_prompt_id"])
            .limit(1)
            .execute()
        )
        if sp_res.data and sp_res.data[0].get("is_active"):
            user_system_prompt = sp_res.data[0]["content"]

    # RAG: pull relevant chunks from the agent's knowledge bases based on the
    # latest user message.
    kb_ids = agent.get("knowledge_base_ids") or []
    last_user_msg = next(
        (m.content for m in reversed(request.messages) if m.role == "user"), None
    )
    context_block: Optional[str] = None
    print(
        f"[chat] agent={agent['id']} kb_ids={kb_ids} "
        f"has_user_msg={bool(last_user_msg)}"
    )
    if kb_ids and last_user_msg:
        try:
            chunks = retrieve_context(
                knowledge_base_ids=kb_ids,
                query=last_user_msg,
                top_k=RAG_TOP_K,
            )
            print(
                f"[chat] retrieved {len(chunks)} chunks from "
                f"{len(kb_ids)} knowledge base(s)"
            )
            if chunks:
                rendered = []
                for i, c in enumerate(chunks, start=1):
                    label = (
                        f"{c['filename']} (v{c['version']})"
                        if c.get("filename")
                        else f"source #{i}"
                    )
                    rendered.append(f"[{i}] {label}\n{c['text'].strip()}")
                context_block = "\n\n".join(rendered)
        except Exception as e:
            # Retrieval failures should never block the chat.
            print(f"[chat] RAG retrieval failed: {e}")

    # Compose the final system prompt: user's prompt + retrieved context.
    parts: list[str] = []
    if user_system_prompt:
        parts.append(user_system_prompt)
    if context_block:
        parts.append(
            "You have access to the following passages from the user's knowledge "
            "base. Use them when relevant and cite the source by its filename. "
            "If the answer isn't in the passages, say so rather than guessing.\n\n"
            f"{context_block}"
        )
    final_system_prompt: Optional[str] = (
        "\n\n---\n\n".join(parts) if parts else None
    )

    # Format messages for the AI provider
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    # Call the AI
    try:
        reply = await chat_completion(
            model_id=agent["model"],
            messages=messages,
            system_prompt=final_system_prompt,
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