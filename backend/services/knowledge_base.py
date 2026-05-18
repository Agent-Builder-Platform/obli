"""
Knowledge base ingestion and retrieval.

Documents are parsed with LlamaIndex readers, chunked with a sentence
splitter, embedded with OpenAI, and stored in a single Qdrant collection.
Each chunk carries metadata so the backend can scope retrieval per user
and per document version.
"""

import hashlib
import json
import os
import tempfile
import uuid
from pathlib import Path
from typing import Any

from llama_index.core import Document, Settings, StorageContext, VectorStoreIndex
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.readers import SimpleDirectoryReader
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.vector_stores.qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from qdrant_client.http.exceptions import UnexpectedResponse


# ── Config ────────────────────────────────────────────────────────────────────

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY") or None
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "obli_knowledge_base")
EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM = 1536
CHUNK_SIZE = 512
CHUNK_OVERLAP = 64

# LlamaIndex reserves the key "document_id" in its Qdrant payload (it stores
# the parent ref_doc_id under that name and clobbers anything we set). We
# namespace our own identifier to avoid the collision.
DOC_ID_KEY = "kb_document_id"


# ── Singletons ────────────────────────────────────────────────────────────────

_qdrant: QdrantClient | None = None
_llamaindex_initialised = False
_indexed_fields: set[str] = set()

INDEX_SPEC: list[tuple[str, qmodels.PayloadSchemaType]] = [
    ("user_id", qmodels.PayloadSchemaType.KEYWORD),
    ("knowledge_base_id", qmodels.PayloadSchemaType.KEYWORD),
    (DOC_ID_KEY, qmodels.PayloadSchemaType.KEYWORD),
    ("filename", qmodels.PayloadSchemaType.KEYWORD),
    ("is_latest", qmodels.PayloadSchemaType.BOOL),
]


def _get_qdrant() -> QdrantClient:
    global _qdrant
    if _qdrant is None:
        _qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    return _qdrant


def _ensure_collection(client: QdrantClient) -> None:
    """Create the collection if missing. Cheap on hot path."""
    existing = {c.name for c in client.get_collections().collections}
    if QDRANT_COLLECTION not in existing:
        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=qmodels.VectorParams(
                size=EMBED_DIM, distance=qmodels.Distance.COSINE
            ),
        )


def _ensure_indexes(client: QdrantClient) -> None:
    """Create payload indexes; idempotent across processes. Only swallows
    'already exists' errors — anything else is logged and re-raised so we
    don't end up with un-indexed fields that strict-mode Qdrant rejects."""
    info = client.get_collection(QDRANT_COLLECTION)
    # `payload_schema` maps field name → PayloadIndexInfo when an index exists.
    already_indexed = set((info.payload_schema or {}).keys())

    for field, schema in INDEX_SPEC:
        if field in already_indexed or field in _indexed_fields:
            _indexed_fields.add(field)
            continue
        try:
            client.create_payload_index(
                collection_name=QDRANT_COLLECTION,
                field_name=field,
                field_schema=schema,
                wait=True,
            )
            _indexed_fields.add(field)
        except UnexpectedResponse as e:
            msg = (e.content or b"").decode("utf-8", errors="ignore")
            if "already exists" in msg.lower() or e.status_code == 409:
                _indexed_fields.add(field)
                continue
            print(
                f"[knowledge_base] failed to create payload index for {field!r}: "
                f"status={e.status_code} body={msg}"
            )
            raise


def _ensure_setup() -> None:
    """Configure LlamaIndex globals, ensure collection + payload indexes exist.

    LlamaIndex globals are set once; collection and index checks run every call
    (both are cheap O(1) Qdrant calls and need to be self-healing).
    """
    global _llamaindex_initialised

    if not _llamaindex_initialised:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is required for knowledge base embeddings"
            )
        Settings.embed_model = OpenAIEmbedding(model=EMBED_MODEL, api_key=api_key)
        Settings.node_parser = SentenceSplitter(
            chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
        )
        Settings.llm = None
        _llamaindex_initialised = True

    client = _get_qdrant()
    _ensure_collection(client)
    _ensure_indexes(client)


# ── Helpers ───────────────────────────────────────────────────────────────────

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md", ".markdown", ".docx", ".doc"}


def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _load_documents(file_path: Path) -> list[Document]:
    """Parse a file on disk into LlamaIndex Document objects."""
    reader = SimpleDirectoryReader(input_files=[str(file_path)])
    return reader.load_data()


# ── Public API ────────────────────────────────────────────────────────────────

def ingest_file(
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str | None,
    user_id: str,
    knowledge_base_id: str,
    document_id: str,
    version: int,
) -> dict[str, Any]:
    """
    Chunk + embed a file's contents into Qdrant. Returns the chunk count.

    Each chunk is stored with payload:
      user_id, uploaded_by, knowledge_base_id, kb_document_id, filename,
      version, is_latest, content_type
    """
    _ensure_setup()

    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {ext or '(no extension)'}")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir) / filename
        tmp_path.write_bytes(file_bytes)
        docs = _load_documents(tmp_path)

    if not docs:
        raise ValueError("Could not extract any text from the file")

    base_metadata = {
        "user_id": user_id,
        "uploaded_by": user_id,
        "knowledge_base_id": knowledge_base_id,
        DOC_ID_KEY: document_id,
        "filename": filename,
        "version": version,
        "is_latest": True,
        "content_type": content_type or "",
    }
    for d in docs:
        d.metadata = {**d.metadata, **base_metadata}

    # Parse to nodes ourselves so we have an authoritative chunk count
    # that doesn't depend on Qdrant write timing or payload conventions.
    nodes = Settings.node_parser.get_nodes_from_documents(docs)
    if not nodes:
        raise ValueError("Document produced no chunks")
    num_chunks = len(nodes)

    # Flip prior-version chunks to not-latest in Qdrant before inserting.
    _mark_previous_versions_not_latest(
        knowledge_base_id=knowledge_base_id,
        filename=filename,
        current_version=version,
    )

    vector_store = QdrantVectorStore(
        client=_get_qdrant(), collection_name=QDRANT_COLLECTION
    )
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    VectorStoreIndex(nodes=nodes, storage_context=storage_context)

    return {"num_chunks": num_chunks}


def _mark_previous_versions_not_latest(
    *, knowledge_base_id: str, filename: str, current_version: int
) -> None:
    """Flip is_latest=false for prior-version chunks of the same filename in this KB."""
    client = _get_qdrant()
    flt = qmodels.Filter(
        must=[
            qmodels.FieldCondition(
                key="knowledge_base_id",
                match=qmodels.MatchValue(value=knowledge_base_id),
            ),
            qmodels.FieldCondition(
                key="filename", match=qmodels.MatchValue(value=filename)
            ),
            qmodels.FieldCondition(
                key="version",
                range=qmodels.Range(lt=current_version),
            ),
        ]
    )
    try:
        client.set_payload(
            collection_name=QDRANT_COLLECTION,
            payload={"is_latest": False},
            points=flt,
        )
    except Exception:
        # No prior points to update is fine.
        pass


def _doc_filter(document_id: str) -> qmodels.Filter:
    return qmodels.Filter(
        must=[
            qmodels.FieldCondition(
                key=DOC_ID_KEY, match=qmodels.MatchValue(value=document_id)
            )
        ]
    )


def _count_chunks(*, document_id: str) -> int:
    client = _get_qdrant()
    count = client.count(
        collection_name=QDRANT_COLLECTION,
        count_filter=_doc_filter(document_id),
        exact=True,
    )
    return int(count.count)


def delete_document_chunks(*, document_id: str) -> int:
    """Remove all chunks belonging to a document from Qdrant. Returns count deleted."""
    _ensure_setup()
    client = _get_qdrant()
    n = _count_chunks(document_id=document_id)
    if n == 0:
        return 0
    client.delete(
        collection_name=QDRANT_COLLECTION,
        points_selector=qmodels.FilterSelector(filter=_doc_filter(document_id)),
    )
    return n


def delete_knowledge_base_chunks(*, knowledge_base_id: str) -> int:
    """Remove all chunks belonging to a knowledge base from Qdrant."""
    _ensure_setup()
    client = _get_qdrant()
    flt = qmodels.Filter(
        must=[
            qmodels.FieldCondition(
                key="knowledge_base_id",
                match=qmodels.MatchValue(value=knowledge_base_id),
            )
        ]
    )
    n = client.count(
        collection_name=QDRANT_COLLECTION, count_filter=flt, exact=True
    ).count
    if n == 0:
        return 0
    client.delete(
        collection_name=QDRANT_COLLECTION,
        points_selector=qmodels.FilterSelector(filter=flt),
    )
    return int(n)


def fetch_chunks_preview(
    *, document_id: str, limit: int = 5
) -> list[dict[str, Any]]:
    """Return a small sample of chunk payloads for UI inspection."""
    _ensure_setup()
    client = _get_qdrant()
    points, _ = client.scroll(
        collection_name=QDRANT_COLLECTION,
        scroll_filter=_doc_filter(document_id),
        limit=limit,
        with_payload=True,
        with_vectors=False,
    )
    out: list[dict[str, Any]] = []
    for p in points:
        payload = p.payload or {}
        text = payload.get("text") or payload.get("_node_content", "")
        out.append(
            {
                "text": (text[:400] + "…") if len(text) > 400 else text,
                "metadata": {
                    k: v
                    for k, v in payload.items()
                    if k not in {"text", "_node_content", "_node_type"}
                },
            }
        )
    return out


def new_document_id() -> str:
    return str(uuid.uuid4())


# ── Retrieval ─────────────────────────────────────────────────────────────────

def retrieve_context(
    *,
    knowledge_base_ids: list[str],
    query: str,
    top_k: int = 4,
    latest_only: bool = True,
) -> list[dict[str, Any]]:
    """
    Embed the query and return the top-k matching chunks across the given KBs.

    Each returned chunk is:
      { text, score, filename, version, knowledge_base_id }
    """
    if not knowledge_base_ids or not query.strip():
        return []

    _ensure_setup()
    embedding = Settings.embed_model.get_query_embedding(query)

    must: list[qmodels.Condition] = [
        qmodels.FieldCondition(
            key="knowledge_base_id",
            match=qmodels.MatchAny(any=list(knowledge_base_ids)),
        ),
    ]
    if latest_only:
        must.append(
            qmodels.FieldCondition(
                key="is_latest", match=qmodels.MatchValue(value=True)
            )
        )

    results = _get_qdrant().search(
        collection_name=QDRANT_COLLECTION,
        query_vector=embedding,
        query_filter=qmodels.Filter(must=must),
        limit=top_k,
        with_payload=True,
    )

    chunks: list[dict[str, Any]] = []
    for r in results:
        payload = r.payload or {}
        text = payload.get("text")
        if not text:
            # LlamaIndex stores the chunk text inside a JSON-encoded
            # `_node_content` blob — fall back to that.
            try:
                node = json.loads(payload.get("_node_content", "{}"))
                text = node.get("text", "")
            except Exception:
                text = ""
        if not text:
            continue
        chunks.append(
            {
                "text": text,
                "score": float(r.score) if r.score is not None else None,
                "filename": payload.get("filename"),
                "version": payload.get("version"),
                "knowledge_base_id": payload.get("knowledge_base_id"),
            }
        )
    return chunks
