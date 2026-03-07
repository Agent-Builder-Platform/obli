"""
AI Providers — Direct API wrappers for Anthropic, OpenAI, and Google Gemini.
No LiteLLM or proxy layers.
"""
from __future__ import annotations

import os
from typing import List, Dict, Optional

import anthropic
from openai import AsyncOpenAI
import google.generativeai as genai

# ── Clients ───────────────────────────────────────────────────────────────────
_anthropic = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
_openai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

# ── Supported model catalogue ─────────────────────────────────────────────────
SUPPORTED_MODELS: List[Dict] = [
    # Anthropic
    {
        "id": "claude-opus-4-5",
        "name": "Claude Opus 4.5",
        "provider": "anthropic",
        "description": "Most intelligent Claude model — best for complex tasks",
        "context_window": 200000,
    },
    {
        "id": "claude-sonnet-4-5",
        "name": "Claude Sonnet 4.5",
        "provider": "anthropic",
        "description": "Balanced speed and capability",
        "context_window": 200000,
    },
    {
        "id": "claude-haiku-4-5",
        "name": "Claude Haiku 4.5",
        "provider": "anthropic",
        "description": "Fastest, most compact Claude — great for high-volume tasks",
        "context_window": 200000,
    },
    # OpenAI
    {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "provider": "openai",
        "description": "OpenAI's flagship multimodal model",
        "context_window": 128000,
    },
    {
        "id": "gpt-4o-mini",
        "name": "GPT-4o Mini",
        "provider": "openai",
        "description": "Affordable and intelligent for lightweight tasks",
        "context_window": 128000,
    },
    {
        "id": "o3-mini",
        "name": "o3-mini",
        "provider": "openai",
        "description": "Fast reasoning model",
        "context_window": 128000,
    },
    # Google
    {
        "id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash",
        "provider": "google",
        "description": "Google's fastest next-gen model",
        "context_window": 1000000,
    },
    {
        "id": "gemini-2.5-pro",
        "name": "Gemini 1.5 Pro",
        "provider": "google",
        "description": "Google's most capable model with 1M token context",
        "context_window": 1000000,
    },
]


def _get_provider(model_id: str) -> str:
    for m in SUPPORTED_MODELS:
        if m["id"] == model_id:
            return m["provider"]
    raise ValueError(f"Unsupported model: {model_id}")


# ── Per-provider chat functions ───────────────────────────────────────────────

async def _chat_anthropic(
    model_id: str,
    messages: List[Dict],
    system_prompt: Optional[str],
) -> str:
    kwargs: dict = {
        "model": model_id,
        "max_tokens": 4096,
        "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
    }
    if system_prompt:
        kwargs["system"] = system_prompt

    response = _anthropic.messages.create(**kwargs)
    return response.content[0].text


_OPENAI_REASONING_MODELS = {"o1", "o1-mini", "o3", "o3-mini"}


async def _chat_openai(
    model_id: str,
    messages: List[Dict],
    system_prompt: Optional[str],
) -> str:
    formatted: List[Dict] = []
    if system_prompt:
        formatted.append({"role": "system", "content": system_prompt})
    formatted.extend({"role": m["role"], "content": m["content"]} for m in messages)

    is_reasoning = model_id in _OPENAI_REASONING_MODELS
    kwargs: dict = {
        "model": model_id,
        "messages": formatted,
        "max_completion_tokens" if is_reasoning else "max_tokens": 4096,
    }

    response = await _openai.chat.completions.create(**kwargs)
    content = response.choices[0].message.content
    if content is None:
        raise ValueError(f"OpenAI returned no content for model {model_id}")
    return content


async def _chat_gemini(
    model_id: str,
    messages: List[Dict],
    system_prompt: Optional[str],
) -> str:
    model = genai.GenerativeModel(
        model_name=model_id,
        system_instruction=system_prompt or None,
    )

    # Build history (all but last message)
    history = []
    for msg in messages[:-1]:
        role = "user" if msg["role"] == "user" else "model"
        history.append({"role": role, "parts": [msg["content"]]})

    chat = model.start_chat(history=history)
    response = chat.send_message(messages[-1]["content"])
    return response.text


# ── Public interface ──────────────────────────────────────────────────────────

async def chat_completion(
    model_id: str,
    messages: List[Dict],
    system_prompt: Optional[str] = None,
) -> str:
    """Route a chat completion to the correct provider."""
    provider = _get_provider(model_id)

    if provider == "anthropic":
        return await _chat_anthropic(model_id, messages, system_prompt)
    elif provider == "openai":
        return await _chat_openai(model_id, messages, system_prompt)
    elif provider == "google":
        return await _chat_gemini(model_id, messages, system_prompt)
    else:
        raise ValueError(f"Unknown provider: {provider}")