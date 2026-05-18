from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from typing import List, Optional

from middleware.auth import get_current_user
from services.supabase_client import supabase
from services import knowledge_base as kb

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class KnowledgeBaseCreate(BaseModel):
    name: str
    description: Optional[str] = None


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_kb(kb_id: str, user_id: str) -> dict:
    resp = (
        supabase.table("knowledge_bases")
        .select("*")
        .eq("id", kb_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return resp.data


# ── Knowledge Base CRUD ───────────────────────────────────────────────────────

@router.get("/bases")
async def list_knowledge_bases(current_user: dict = Depends(get_current_user)):
    """List all knowledge bases owned by the current user, with doc counts."""
    user_id = current_user["sub"]
    bases = (
        supabase.table("knowledge_bases")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    counts: dict[str, int] = {}
    if bases.data:
        docs = (
            supabase.table("knowledge_documents")
            .select("knowledge_base_id")
            .in_("knowledge_base_id", [b["id"] for b in bases.data])
            .execute()
        )
        for row in docs.data or []:
            counts[row["knowledge_base_id"]] = counts.get(row["knowledge_base_id"], 0) + 1

    enriched = [{**b, "document_count": counts.get(b["id"], 0)} for b in bases.data]
    return {"knowledge_bases": enriched, "total": len(enriched)}


@router.post("/bases", status_code=201)
async def create_knowledge_base(
    payload: KnowledgeBaseCreate, current_user: dict = Depends(get_current_user)
):
    user_id = current_user["sub"]
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    resp = (
        supabase.table("knowledge_bases")
        .insert(
            {
                "user_id": user_id,
                "name": payload.name.strip(),
                "description": payload.description,
            }
        )
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to create knowledge base")
    return {"knowledge_base": {**resp.data[0], "document_count": 0}}


@router.get("/bases/{kb_id}")
async def get_knowledge_base(
    kb_id: str, current_user: dict = Depends(get_current_user)
):
    user_id = current_user["sub"]
    kb_row = _require_kb(kb_id, user_id)
    docs = (
        supabase.table("knowledge_documents")
        .select("*")
        .eq("knowledge_base_id", kb_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {
        "knowledge_base": {**kb_row, "document_count": len(docs.data or [])},
        "documents": docs.data or [],
    }


@router.put("/bases/{kb_id}")
async def update_knowledge_base(
    kb_id: str,
    payload: KnowledgeBaseUpdate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    _require_kb(kb_id, user_id)
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update fields provided")
    resp = (
        supabase.table("knowledge_bases")
        .update(update_data)
        .eq("id", kb_id)
        .eq("user_id", user_id)
        .execute()
    )
    return {"knowledge_base": resp.data[0]}


@router.delete("/bases/{kb_id}")
async def delete_knowledge_base(
    kb_id: str, current_user: dict = Depends(get_current_user)
):
    user_id = current_user["sub"]
    _require_kb(kb_id, user_id)
    # Drop all vectors first, then cascade-delete metadata via FK.
    kb.delete_knowledge_base_chunks(knowledge_base_id=kb_id)
    supabase.table("knowledge_bases").delete().eq("id", kb_id).eq(
        "user_id", user_id
    ).execute()
    return {"message": "Knowledge base deleted"}


# ── Documents ─────────────────────────────────────────────────────────────────

@router.get("/bases/{kb_id}/documents")
async def list_documents(
    kb_id: str, current_user: dict = Depends(get_current_user)
):
    user_id = current_user["sub"]
    _require_kb(kb_id, user_id)
    resp = (
        supabase.table("knowledge_documents")
        .select("*")
        .eq("knowledge_base_id", kb_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"documents": resp.data, "total": len(resp.data)}


@router.post("/bases/{kb_id}/documents", status_code=201)
async def upload_documents(
    kb_id: str,
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload one or more files into a knowledge base. Each file is parsed,
    chunked, embedded and stored in Qdrant. Re-uploading the same filename
    within the same KB bumps its version.
    """
    user_id = current_user["sub"]
    _require_kb(kb_id, user_id)
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    uploaded: list[dict] = []
    failed: list[dict] = []

    for upload in files:
        try:
            data = await upload.read()
            if not data:
                raise ValueError("Empty file")
            file_hash = kb.compute_sha256(data)
            filename = upload.filename or "untitled"

            prior = (
                supabase.table("knowledge_documents")
                .select("version")
                .eq("knowledge_base_id", kb_id)
                .eq("filename", filename)
                .order("version", desc=True)
                .limit(1)
                .execute()
            )
            next_version = (prior.data[0]["version"] + 1) if prior.data else 1
            document_id = kb.new_document_id()

            result = kb.ingest_file(
                file_bytes=data,
                filename=filename,
                content_type=upload.content_type,
                user_id=user_id,
                knowledge_base_id=kb_id,
                document_id=document_id,
                version=next_version,
            )

            if next_version > 1:
                supabase.table("knowledge_documents").update(
                    {"is_latest": False}
                ).eq("knowledge_base_id", kb_id).eq("filename", filename).execute()

            insert = (
                supabase.table("knowledge_documents")
                .insert(
                    {
                        "id": document_id,
                        "knowledge_base_id": kb_id,
                        "user_id": user_id,
                        "filename": filename,
                        "content_type": upload.content_type,
                        "byte_size": len(data),
                        "file_hash": file_hash,
                        "version": next_version,
                        "num_chunks": result["num_chunks"],
                        "is_latest": True,
                    }
                )
                .execute()
            )
            if not insert.data:
                kb.delete_document_chunks(document_id=document_id)
                raise RuntimeError("Failed to persist document metadata")

            uploaded.append(insert.data[0])
        except Exception as e:
            failed.append({"filename": upload.filename, "error": str(e)})

    if not uploaded and failed:
        raise HTTPException(
            status_code=400,
            detail={"message": "All uploads failed", "failures": failed},
        )

    return {"uploaded": uploaded, "failed": failed}


@router.get("/documents/{document_id}/chunks")
async def get_document_chunks(
    document_id: str, current_user: dict = Depends(get_current_user)
):
    user_id = current_user["sub"]
    doc = (
        supabase.table("knowledge_documents")
        .select("*")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"chunks": kb.fetch_chunks_preview(document_id=document_id)}


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str, current_user: dict = Depends(get_current_user)
):
    user_id = current_user["sub"]
    existing = (
        supabase.table("knowledge_documents")
        .select("id, knowledge_base_id, filename, version, is_latest")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Document not found")

    kb.delete_document_chunks(document_id=document_id)
    supabase.table("knowledge_documents").delete().eq("id", document_id).eq(
        "user_id", user_id
    ).execute()

    # Promote the next-highest version (same KB + filename) to latest.
    if existing.data["is_latest"]:
        remaining = (
            supabase.table("knowledge_documents")
            .select("id, version")
            .eq("knowledge_base_id", existing.data["knowledge_base_id"])
            .eq("filename", existing.data["filename"])
            .order("version", desc=True)
            .limit(1)
            .execute()
        )
        if remaining.data:
            supabase.table("knowledge_documents").update({"is_latest": True}).eq(
                "id", remaining.data[0]["id"]
            ).execute()

    return {"message": "Document deleted"}
