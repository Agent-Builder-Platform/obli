from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import get_supabase

router = APIRouter()


class WaitlistEntry(BaseModel):
    name: str
    email: str
    role: Optional[str] = None
    company: Optional[str] = None
    reason: str
    use_type: str  # 'personal', 'team', 'enterprise'
    team_size: Optional[str] = None


@router.get("/count")
async def waitlist_count():
    supabase = get_supabase()
    result = supabase.table("waitlist").select("id", count="exact").execute()
    return {"count": result.count or 0}


@router.post("/")
async def join_waitlist(entry: WaitlistEntry):
    if entry.use_type not in ("team", "enterprise"):
        raise HTTPException(status_code=400, detail="Invalid use_type")

    if not entry.team_size:
        raise HTTPException(status_code=400, detail="Team size is required")

    supabase = get_supabase()

    existing = (
        supabase.table("waitlist").select("id").eq("email", entry.email).execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="This email is already on the waitlist")

    result = supabase.table("waitlist").insert(entry.model_dump()).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to join waitlist")

    return {"message": "You're on the waitlist! We'll be in touch soon."}
