"""File validation, filename sanitization, metadata extraction, SHA-256."""
from __future__ import annotations

import hashlib
import io
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.config import settings

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".docx", ".txt"}

ALLOWED_MIMES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}

EXT_TO_MIMES = {
    ".pdf": {"application/pdf"},
    ".png": {"image/png"},
    ".jpg": {"image/jpeg", "image/jpg"},
    ".jpeg": {"image/jpeg", "image/jpg"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".txt": {"text/plain", "text/txt", "application/octet-stream"},
}

MIME_TO_TYPE = {
    "application/pdf": "PDF",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "text/plain": "TXT",
}


def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sanitize_filename(filename: str) -> str:
    """Never trust the original filename. Strip paths and dangerous characters."""
    name = (filename or "").replace("\\", "/")
    name = name.split("/")[-1]
    name = name.strip().lstrip(".")
    name = re.sub(r"[^\w.\- ]+", "_", name, flags=re.UNICODE)
    name = re.sub(r"\s+", "_", name).strip("._")
    if not name or name in {".", ".."}:
        return f"unnamed_{uuid.uuid4().hex[:8]}.bin"
    stem, ext = os.path.splitext(name)
    stem = (stem or "file")[:80]
    ext = ext.lower()[:10]
    return f"{stem}{ext}"


def _sniff_mime(data: bytes) -> Optional[str]:
    if data.startswith(b"%PDF"):
        return "application/pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"PK\x03\x04"):
        # DOCX is a zip; confirm content types if possible
        if b"word/" in data[:8000] or b"[Content_Types].xml" in data[:8000]:
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        # still allow if caller claims docx and it's a zip
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    # UTF-8 / ASCII text heuristic
    sample = data[:4096]
    if not sample:
        return None
    if b"\x00" in sample:
        return None
    try:
        sample.decode("utf-8")
        return "text/plain"
    except UnicodeDecodeError:
        return None


def validate_file(
    filename: str,
    content_type: str,
    size: int,
    file_bytes: Optional[bytes] = None,
    max_mb: Optional[int] = None,
) -> Optional[str]:
    """Validate extension, MIME, size, and filename. Returns error message or None."""
    max_mb = max_mb if max_mb is not None else settings.MAX_UPLOAD_SIZE_MB
    if not filename or not str(filename).strip():
        return "Filename is required"
    if ".." in filename.replace("\\", "/") or filename.startswith("/") or ":\\" in filename:
        return "Invalid filename"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return f"File extension '{ext or '(none)'}' is not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
    if size <= 0:
        return "Empty files are not allowed"
    if size > max_mb * 1024 * 1024:
        return f"File exceeds maximum size of {max_mb}MB"

    declared = (content_type or "").split(";")[0].strip().lower()
    if declared and declared not in ALLOWED_MIMES and declared != "application/octet-stream":
        return f"MIME type '{declared}' is not allowed"

    allowed_for_ext = EXT_TO_MIMES.get(ext, set())
    if declared and declared != "application/octet-stream" and declared not in allowed_for_ext:
        return f"MIME type '{declared}' does not match file extension '{ext}'"

    if file_bytes is not None:
        sniffed = _sniff_mime(file_bytes)
        if sniffed is None:
            return "Unable to determine file type from contents"
        if sniffed not in allowed_for_ext and not (
            ext == ".docx" and sniffed.endswith("wordprocessingml.document")
        ):
            return f"File contents ({sniffed}) do not match extension '{ext}'"
    return None


def file_type_from_mime(mime: str, filename: str = "") -> str:
    mime = (mime or "").split(";")[0].strip().lower()
    if mime in MIME_TO_TYPE:
        return MIME_TO_TYPE[mime]
    ext = os.path.splitext(filename)[1].lower().lstrip(".")
    return ext.upper() or "DOCUMENT"


def extract_metadata(file_bytes: bytes, filename: str, mime_type: str) -> dict:
    """Extract real file metadata (not AI)."""
    ext = os.path.splitext(filename)[1].lower()
    meta = {
        "original_filename": sanitize_filename(filename),
        "extension": ext,
        "mime_type": mime_type,
        "file_type": file_type_from_mime(mime_type, filename),
        "file_size": len(file_bytes),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "page_count": None,
        "image_width": None,
        "image_height": None,
        "text_preview": None,
    }
    try:
        if mime_type.startswith("image/") or ext in {".png", ".jpg", ".jpeg"}:
            from PIL import Image
            img = Image.open(io.BytesIO(file_bytes))
            meta["image_width"], meta["image_height"] = img.size
            meta["image_mode"] = img.mode
        elif ext == ".txt" or mime_type == "text/plain":
            text = file_bytes.decode("utf-8", errors="replace")
            meta["text_preview"] = text[:240]
            meta["line_count"] = text.count("\n") + 1
        elif ext == ".docx":
            from docx import Document
            doc = Document(io.BytesIO(file_bytes))
            paras = [p.text for p in doc.paragraphs if p.text.strip()]
            meta["paragraph_count"] = len(paras)
            meta["text_preview"] = " ".join(paras)[:240]
        elif ext == ".pdf" or mime_type == "application/pdf":
            try:
                import fitz
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                meta["page_count"] = doc.page_count
                if doc.page_count:
                    meta["text_preview"] = (doc[0].get_text() or "")[:240]
                doc.close()
            except Exception:
                if file_bytes.startswith(b"%PDF"):
                    meta["pdf_header"] = file_bytes[:16].decode("latin-1", errors="ignore")
    except Exception as exc:
        meta["extraction_note"] = str(exc)
    return meta


def generate_storage_filename(safe_original: str) -> str:
    ext = os.path.splitext(safe_original)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".bin"
    return f"{uuid.uuid4().hex}{ext}.enc"
