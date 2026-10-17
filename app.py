import os
import io
import re
import html
import json
import time
import uuid
import shutil
import zipfile
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

import requests
from dotenv import load_dotenv, set_key
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pypdf import PdfReader, PdfWriter

# Load environment variables from .env file
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(ENV_FILE)

DATA_DIR = BASE_DIR / "data"
DOCS_DIR = DATA_DIR / "documents"
PROJECTS_FILE = DATA_DIR / "projects.json"
DOCS_DIR.mkdir(parents=True, exist_ok=True)

SARVAM_BASE_URL = "https://api.sarvam.ai"
DOC_AI_DIGITISE_URL = f"{SARVAM_BASE_URL}/doc-ai/v1/job/digitise"
DOC_AI_STATUS_URL = f"{SARVAM_BASE_URL}/doc-ai/v1/job/{{job_id}}/status"
DOC_AI_DOWNLOAD_URL = f"{SARVAM_BASE_URL}/doc-ai/v1/job/{{job_id}}/download-url"
CHAT_COMPLETIONS_V1_URL = f"{SARVAM_BASE_URL}/v1/chat/completions"

app = FastAPI(
    title="Patra — Sarvam Study Desk & Assignment Workbench",
    description="Local-first document reader, assignment organizer, and multi-chat doubt solver powered exclusively by Sarvam Vision 1.5 and Sarvam-105B.",
)


@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


ACTIVE_JOBS: Dict[str, Dict[str, Any]] = {}


def get_api_key(override_key: Optional[str] = None) -> str:
    if override_key and override_key.strip():
        return override_key.strip()
    load_dotenv(ENV_FILE, override=True)
    key = os.environ.get("SARVAM_API_KEY", "").strip()
    if key == "your_sarvam_api_key_here":
        return ""
    return key


def mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "*" * len(key)
    return f"{key[:4]}{'•' * (len(key) - 8)}{key[-4:]}"


# ---------------------------------------------------------------------------
# Sarvam Vision 1.5 Output Sanitizer & LaTeX Math Normalizer
# ---------------------------------------------------------------------------

def clean_latex_math_inner(math_str: str) -> str:
    """
    Cleans HTML entities and OCR quirks inside a LaTeX math block so KaTeX renders cleanly.
    """
    s = html.unescape(math_str)
    # Fix stray HTML tags that occasionally appear inside OCR formula blocks
    s = re.sub(r"</?(?:em|i|b|strong|span|br\s*/?)>", " ", s)
    return s.strip()


def normalize_sarvam_html(raw_html: str) -> str:
    """
    Transforms Sarvam Vision 1.5's raw HTML output into clean, theme-aware semantic HTML:
    1. Strips <head>, <style>, <html>, <body> wrappers that pollute global page CSS & break dark mode.
    2. Preserves Sarvam Vision layout classes: .page-body-container, .centered-block, header.header,
       footer.footer, h1.chapter-title, h2.section-title, h2.headline, h3.sub-section-title,
       .multi-column-row, .column-block, p.paragraph, p.formula, .table, figure.image.
    3. Unwraps <p class="formula"><code>...</code></p> keeping <p class="formula" data-editable-math="true">...</p>
       so KaTeX renders all equations properly in their exact original column and centered positions.
    4. Decodes HTML entities (&amp;, &lt;, &gt;, &#39;) inside LaTeX math expressions.
    5. Numbers each .page-body-container with data-page="N" for page navigation & clean card layout.
    """
    if not raw_html or not raw_html.strip():
        return ""

    text = raw_html

    # 1. Extract body content if full HTML document
    body_match = re.search(r"<body[^>]*>(.*)</body>", text, flags=re.DOTALL | re.IGNORECASE)
    if body_match:
        text = body_match.group(1)

    # Remove any embedded <style>...</style> blocks so Sarvam's `body { background: white !important }` never breaks themes
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # Remove excessive <br><br> between page containers
    text = re.sub(r"(\s*<br\s*/?>\s*){2,}", "\n", text, flags=re.IGNORECASE)

    # Convert any legacy <div class="math-formula-block"> back to <p class="formula" data-editable-math="true">
    def convert_legacy_div_formula(match: re.Match) -> str:
        inner = clean_latex_math_inner(match.group(1))
        if not inner:
            return ""
        if "$$" in inner or "$" in inner:
            return f'<p class="formula" data-editable-math="true">{inner}</p>'
        return f'<p class="formula" data-editable-math="true">$${inner}$$</p>'

    text = re.sub(
        r'<div\s+class=["\']math-formula-block["\'][^>]*>(.*?)</div>',
        convert_legacy_div_formula,
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )

    # 2. Preserve <p class="formula" data-editable-math="true"> unwrapping inner <code> and decoding entities
    def replace_formula(match: re.Match) -> str:
        inner = match.group(1)
        # Unwrap <code>...</code> if present inside
        inner = re.sub(r"</?code[^>]*>", "", inner, flags=re.IGNORECASE)
        cleaned = clean_latex_math_inner(inner)
        if not cleaned:
            return ""
        if "$$" in cleaned or "$" in cleaned:
            return f'<p class="formula" data-editable-math="true">{cleaned}</p>'
        return f'<p class="formula" data-editable-math="true">$${cleaned}$$</p>'

    text = re.sub(
        r'<p\s+class=["\']formula["\'][^>]*>(.*?)</p>',
        replace_formula,
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )

    # Also unwrap any standalone <code>$$...$$</code> or <code>$...$</code> anywhere in the HTML
    def unwrap_inline_code_math(match: re.Match) -> str:
        inner = clean_latex_math_inner(match.group(1))
        return f'<span class="math-inline-wrap">{inner}</span>'

    text = re.sub(
        r"<code>(\s*\$\$?.*?\$\$?\s*)</code>",
        unwrap_inline_code_math,
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )

    # 3. Number .page-body-container divs as clean page cards
    page_counter = {"n": 0}

    def number_page_container(match: re.Match) -> str:
        page_counter["n"] += 1
        n = page_counter["n"]
        tag = match.group(0)
        if "data-page=" in tag:
            return tag
        return (
            f'<div class="page-body-container" id="doc-page-{n}" data-page="{n}">'
            f'<div class="page-card-ribbon"><span>Page {n}</span></div>'
        )

    text = re.sub(
        r'<div\s+class=["\']page-body-container["\'][^>]*>',
        number_page_container,
        text,
        flags=re.IGNORECASE,
    )

    return text.strip()


def normalize_sarvam_markdown(raw_md: str) -> str:
    """
    Cleans Sarvam Vision 1.5 Markdown output so backtick-wrapped LaTeX (`$$...$$`) renders as real math.
    """
    if not raw_md or not raw_md.strip():
        return ""
    if "<!DOCTYPE html>" in raw_md or "<div class=\"page-body-container\">" in raw_md:
        return normalize_sarvam_html(raw_md)

    text = raw_md
    # Unwrap ```math or `$$...$$` backticks around display/inline math
    text = re.sub(
        r"`(\$\$[\s\S]*?\$\$)`",
        lambda m: clean_latex_math_inner(m.group(1)),
        text,
    )
    text = re.sub(
        r"`(\$[^\$\n]+?\$)`",
        lambda m: clean_latex_math_inner(m.group(1)),
        text,
    )
    return text.strip()


def count_readable_words(content: str) -> int:
    # Strip base64 data URIs and HTML tags before counting words
    no_b64 = re.sub(r"data:image/[^;]+;base64,[A-Za-z0-9+/=]+", "", content)
    no_tags = re.sub(r"<[^>]+>", " ", no_b64)
    return len(no_tags.split())


# ---------------------------------------------------------------------------
# Projects / Courses Management
# ---------------------------------------------------------------------------

DEFAULT_PROJECTS = [
    {"id": "proj-signals", "name": "Signal Processing", "color": "#C85A32", "icon": "wave"},
    {"id": "proj-physics", "name": "Physics & Thermo", "color": "#2E6F5E", "icon": "atom"},
    {"id": "proj-general", "name": "General Notes", "color": "#5B6078", "icon": "book"},
]


def load_projects() -> List[Dict[str, Any]]:
    if not PROJECTS_FILE.exists():
        save_projects(DEFAULT_PROJECTS)
        return DEFAULT_PROJECTS
    try:
        with open(PROJECTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_PROJECTS


def save_projects(projects: List[Dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(PROJECTS_FILE, "w", encoding="utf-8") as f:
        json.dump(projects, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Document & Multi-Chat Storage Helpers
# ---------------------------------------------------------------------------

def get_doc_dir(doc_id: str) -> Path:
    return DOCS_DIR / doc_id


def upgrade_doc_schema(meta: Dict[str, Any]) -> tuple[Dict[str, Any], bool]:
    """
    Upgrades older document metadata in-place:
    - Migrates flat `chat_history` into multi-thread `chats` list
    - Normalizes raw Sarvam HTML/Markdown so equations and dark mode work immediately
    - Ensures project_id, category, assignment_status, starred fields exist
    """
    changed = False

    # 1. Normalize Sarvam HTML / Markdown and convert <div class="math-formula-block"> back to <p class="formula">
    raw_content = meta.get("markdown", "")
    if raw_content and (
        "<style>" in raw_content
        or '<p class="formula"><code>' in raw_content
        or '<div class="math-formula-block">' in raw_content
        or "background-color: white !important" in raw_content
    ):
        cleaned = raw_content
        if '<div class="math-formula-block">' in cleaned:
            cleaned = re.sub(
                r'<div\s+class=["\']math-formula-block["\'][^>]*>(.*?)</div>',
                r'<p class="formula" data-editable-math="true">\1</p>',
                cleaned,
                flags=re.DOTALL | re.IGNORECASE,
            )
        cleaned = normalize_sarvam_html(cleaned) if meta.get("output_format") == "html" or "<html" in cleaned or '<div class="page-body-container"' in cleaned else normalize_sarvam_markdown(cleaned)
        meta["markdown"] = cleaned
        meta["word_count"] = count_readable_words(cleaned)
        changed = True

    # 2. Ensure organization fields exist
    if "project_id" not in meta:
        title_lower = (meta.get("title", "") + " " + raw_content[:600]).lower()
        if "signal" in title_lower or "dtft" in title_lower or "a1" in title_lower:
            meta["project_id"] = "proj-signals"
            meta["category"] = "Assignment"
            if meta.get("title") == "2025102076 A1 1":
                meta["title"] = "Signal Processing Assignment 1 (2025102076)"
        elif "thermo" in title_lower or "entropy" in title_lower:
            meta["project_id"] = "proj-physics"
            meta["category"] = "Lecture Notes"
        else:
            meta["project_id"] = "proj-general"
            meta["category"] = "Lecture Notes"
        changed = True

    if "category" not in meta:
        meta["category"] = "Assignment" if "assignment" in meta.get("title", "").lower() else "Lecture Notes"
        changed = True

    if "assignment_status" not in meta:
        meta["assignment_status"] = "in_progress"  # "todo" | "in_progress" | "completed"
        changed = True

    if "starred" not in meta:
        meta["starred"] = False
        changed = True

    if "updated_at" not in meta:
        meta["updated_at"] = meta.get("created_at") or datetime.now().isoformat()
        changed = True

    # 3. Migrate legacy flat `chat_history` into `chats` (multi-thread support)
    if "chats" not in meta or not isinstance(meta["chats"], list):
        legacy_turns = meta.get("chat_history", [])
        default_chat_id = f"chat-{str(uuid.uuid4())[:8]}"
        first_user_msg = next((t.get("content", "") for t in legacy_turns if t.get("role") == "user"), "")
        thread_title = (first_user_msg[:42] + "...") if len(first_user_msg) > 42 else (first_user_msg or "General Doubts")

        if legacy_turns:
            meta["chats"] = [
                {
                    "id": default_chat_id,
                    "title": thread_title,
                    "created_at": legacy_turns[0].get("timestamp") or meta.get("created_at") or datetime.now().isoformat(),
                    "updated_at": legacy_turns[-1].get("timestamp") or datetime.now().isoformat(),
                    "messages": legacy_turns,
                }
            ]
        else:
            meta["chats"] = []
        changed = True

    return meta, changed


def load_doc_meta(doc_id: str) -> Dict[str, Any]:
    meta_path = get_doc_dir(doc_id) / "meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Document not found")
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    meta, changed = upgrade_doc_schema(meta)
    if changed:
        save_doc_meta(doc_id, meta)
        ext = "html" if meta.get("output_format") == "html" else "md"
        content_file = get_doc_dir(doc_id) / f"content.{ext}"
        if content_file.exists() and meta.get("markdown"):
            try:
                with open(content_file, "w", encoding="utf-8") as f:
                    f.write(meta["markdown"])
            except Exception:
                pass
    return meta


def save_doc_meta(doc_id: str, meta: Dict[str, Any]) -> None:
    doc_dir = get_doc_dir(doc_id)
    doc_dir.mkdir(parents=True, exist_ok=True)
    meta_path = doc_dir / "meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


def list_all_docs() -> List[Dict[str, Any]]:
    docs = []
    if not DOCS_DIR.exists():
        return docs
    for folder in DOCS_DIR.iterdir():
        if folder.is_dir():
            meta_file = folder / "meta.json"
            if meta_file.exists():
                try:
                    meta = load_doc_meta(folder.name)
                    chats = meta.get("chats", [])
                    total_msgs = sum(len(c.get("messages", [])) for c in chats)
                    docs.append({
                        "id": meta.get("id"),
                        "title": meta.get("title"),
                        "filename": meta.get("filename"),
                        "project_id": meta.get("project_id", "proj-general"),
                        "category": meta.get("category", "Lecture Notes"),
                        "assignment_status": meta.get("assignment_status", "in_progress"),
                        "starred": bool(meta.get("starred", False)),
                        "language": meta.get("language", "en-IN"),
                        "output_format": meta.get("output_format", "md"),
                        "pages_total": meta.get("pages_total", 1),
                        "created_at": meta.get("created_at"),
                        "updated_at": meta.get("updated_at") or meta.get("created_at"),
                        "status": meta.get("status", "completed"),
                        "word_count": meta.get("word_count", 0),
                        "chat_threads_count": len(chats),
                        "chat_messages_count": total_msgs,
                    })
                except Exception:
                    continue
    docs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return docs


def list_all_global_chats() -> List[Dict[str, Any]]:
    """Returns all chat threads across all documents sorted by most recently active."""
    all_threads = []
    if not DOCS_DIR.exists():
        return all_threads
    for folder in DOCS_DIR.iterdir():
        if folder.is_dir() and (folder / "meta.json").exists():
            try:
                meta = load_doc_meta(folder.name)
                doc_id = meta.get("id")
                doc_title = meta.get("title", "Untitled")
                project_id = meta.get("project_id", "proj-general")
                for c in meta.get("chats", []):
                    msgs = c.get("messages", [])
                    last_msg = msgs[-1].get("content", "") if msgs else ""
                    all_threads.append({
                        "chat_id": c.get("id"),
                        "title": c.get("title", "Doubt Thread"),
                        "doc_id": doc_id,
                        "doc_title": doc_title,
                        "project_id": project_id,
                        "message_count": len(msgs),
                        "last_message_preview": last_msg[:120],
                        "created_at": c.get("created_at"),
                        "updated_at": c.get("updated_at") or c.get("created_at"),
                    })
            except Exception:
                continue
    all_threads.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return all_threads


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------

class ApiKeyPayload(BaseModel):
    api_key: str


class ProjectCreatePayload(BaseModel):
    name: str
    color: str = "#C85A32"
    icon: Optional[str] = "book"


class ProjectUpdatePayload(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class DocumentUpdatePayload(BaseModel):
    title: Optional[str] = None
    markdown: Optional[str] = None
    project_id: Optional[str] = None
    category: Optional[str] = None
    assignment_status: Optional[str] = None
    starred: Optional[bool] = None


class ChatThreadCreatePayload(BaseModel):
    title: Optional[str] = "New Doubt Session"


class ChatThreadRenamePayload(BaseModel):
    title: str


class ChatThreadRestorePayload(BaseModel):
    id: str
    title: Optional[str] = "Restored Doubt Session"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    messages: Optional[List[Dict[str, Any]]] = None

    class Config:
        extra = "allow"


class ChatRequest(BaseModel):
    doc_id: str
    chat_id: Optional[str] = None
    message: str
    selected_excerpt: Optional[str] = None
    model: str = "sarvam-105b"
    reasoning_effort: Optional[str] = "low"
    temperature: float = 0.4


# ---------------------------------------------------------------------------
# PDF Splitting & ZIP Extraction for Sarvam Doc AI
# ---------------------------------------------------------------------------

def split_pdf_into_batches(pdf_bytes: bytes, max_pages_per_batch: int = 10) -> tuple[int, List[tuple[int, int, bytes]]]:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    total_pages = len(reader.pages)
    if total_pages <= max_pages_per_batch:
        return total_pages, [(1, total_pages, pdf_bytes)]

    batches = []
    for start_idx in range(0, total_pages, max_pages_per_batch):
        end_idx = min(start_idx + max_pages_per_batch, total_pages)
        writer = PdfWriter()
        for page_num in range(start_idx, end_idx):
            writer.add_page(reader.pages[page_num])
        buf = io.BytesIO()
        writer.write(buf)
        batches.append((start_idx + 1, end_idx, buf.getvalue()))

    return total_pages, batches


def extract_content_from_sarvam_zip(raw_bytes: bytes, output_format: str = "md") -> tuple[str, List[Dict[str, Any]]]:
    page_metadata: List[Dict[str, Any]] = []
    if not zipfile.is_zipfile(io.BytesIO(raw_bytes)):
        text = raw_bytes.decode("utf-8", errors="replace")
        cleaned = normalize_sarvam_html(text) if output_format == "html" or "<html" in text else normalize_sarvam_markdown(text)
        return cleaned, page_metadata

    primary_texts: List[tuple[str, str]] = []
    with zipfile.ZipFile(io.BytesIO(raw_bytes), "r") as zf:
        namelist = sorted(zf.namelist())
        for name in namelist:
            if name.endswith("/"):
                continue
            lower = name.lower()
            if lower.startswith("metadata/") and lower.endswith(".json"):
                try:
                    meta_json = json.loads(zf.read(name).decode("utf-8", errors="replace"))
                    page_metadata.append(meta_json)
                except Exception:
                    pass
            elif lower == "manifest.json":
                continue
            elif lower.endswith((".md", ".markdown", ".html", ".htm", ".txt")):
                content = zf.read(name).decode("utf-8", errors="replace")
                primary_texts.append((name, content))
            elif output_format == "json" and lower.endswith(".json"):
                content = zf.read(name).decode("utf-8", errors="replace")
                primary_texts.append((name, content))

        if not primary_texts:
            for name in namelist:
                lower = name.lower()
                if not name.endswith("/") and lower != "manifest.json" and not lower.startswith("metadata/"):
                    content = zf.read(name).decode("utf-8", errors="replace")
                    primary_texts.append((name, content))

    raw_combined = "\n\n".join(text.strip() for _, text in primary_texts if text.strip())
    if output_format == "html" or "<html" in raw_combined or '<div class="page-body-container">' in raw_combined:
        cleaned = normalize_sarvam_html(raw_combined)
    else:
        cleaned = normalize_sarvam_markdown(raw_combined)
    return cleaned, page_metadata


# ---------------------------------------------------------------------------
# Background Worker: Sarvam Doc AI Digitise Pipeline
# ---------------------------------------------------------------------------

def run_digitise_pipeline(
    doc_id: str,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    language: str,
    output_format: str,
    api_key: str,
):
    try:
        is_pdf = filename.lower().endswith(".pdf") or content_type == "application/pdf"
        if is_pdf:
            total_pages, batches = split_pdf_into_batches(file_bytes, max_pages_per_batch=10)
        else:
            total_pages = 1
            batches = [(1, 1, file_bytes)]

        ACTIVE_JOBS[doc_id].update({
            "status": "running",
            "stage": "Preparing document...",
            "pages_total": total_pages,
            "pages_processed": 0,
            "batches_total": len(batches),
            "current_batch": 1,
        })

        headers = {"api-subscription-key": api_key}
        all_markdown_parts: List[str] = []
        all_page_meta: List[Dict[str, Any]] = []
        sarvam_job_ids: List[str] = []
        pages_completed_so_far = 0

        for batch_idx, (start_p, end_p, batch_bytes) in enumerate(batches, start=1):
            batch_page_count = end_p - start_p + 1
            batch_label = (
                f"Batch {batch_idx}/{len(batches)} (Pages {start_p}–{end_p})"
                if len(batches) > 1
                else f"Pages 1–{total_pages}"
            )
            ACTIVE_JOBS[doc_id].update({
                "current_batch": batch_idx,
                "stage": f"Uploading {batch_label}...",
            })

            batch_filename = (
                f"{Path(filename).stem}_p{start_p}-{end_p}.pdf"
                if len(batches) > 1
                else filename
            )

            files = {
                "file": (batch_filename, io.BytesIO(batch_bytes), content_type or "application/pdf")
            }
            data = {
                "language": language,
                "output_format": output_format,
            }

            resp = requests.post(
                DOC_AI_DIGITISE_URL,
                headers=headers,
                files=files,
                data=data,
                timeout=90,
            )

            if resp.status_code not in (200, 201, 202):
                err_detail = resp.text
                try:
                    err_json = resp.json()
                    err_detail = err_json.get("error", {}).get("message") or err_json.get("detail") or resp.text
                except Exception:
                    pass
                raise RuntimeError(f"Document conversion error ({resp.status_code}): {err_detail}")

            job_info = resp.json()
            sarvam_job_id = job_info.get("job_id")
            if not sarvam_job_id:
                raise RuntimeError(f"No job_id returned from conversion API: {job_info}")

            sarvam_job_ids.append(sarvam_job_id)

            terminal_states = {"completed", "partially_completed", "failed", "rejected"}
            status_str = job_info.get("status", "pending").lower()

            while status_str not in terminal_states:
                time.sleep(2.2)
                st_resp = requests.get(
                    DOC_AI_STATUS_URL.format(job_id=sarvam_job_id),
                    headers=headers,
                    timeout=30,
                )
                if st_resp.status_code != 200:
                    raise RuntimeError(f"Failed polling job status ({st_resp.status_code}): {st_resp.text}")

                st_data = st_resp.json()
                status_str = st_data.get("status", "running").lower()
                usage = st_data.get("usage") or {}
                batch_done = usage.get("pages_processed", 0)

                ACTIVE_JOBS[doc_id].update({
                    "status": "running",
                    "stage": f"Digitising {batch_label} ({batch_done}/{batch_page_count} pages)...",
                    "pages_processed": min(total_pages, pages_completed_so_far + batch_done),
                })

            if status_str in {"failed", "rejected"}:
                raise RuntimeError(f"Sarvam Doc AI job {sarvam_job_id} ended with status: {status_str}")

            ACTIVE_JOBS[doc_id].update({
                "stage": f"Extracting & formatting equations for {batch_label}...",
            })
            dl_resp = requests.get(
                DOC_AI_DOWNLOAD_URL.format(job_id=sarvam_job_id),
                headers=headers,
                timeout=30,
            )
            if dl_resp.status_code != 200:
                raise RuntimeError(f"Failed fetching download URL ({dl_resp.status_code}): {dl_resp.text}")

            dl_info = dl_resp.json()
            presigned_url = dl_info.get("url")
            if not presigned_url:
                raise RuntimeError(f"Missing download URL in response: {dl_info}")

            zip_resp = requests.get(presigned_url, timeout=90)
            if zip_resp.status_code != 200:
                raise RuntimeError(f"Failed downloading output archive ({zip_resp.status_code})")

            extracted_text, page_meta = extract_content_from_sarvam_zip(zip_resp.content, output_format)
            if extracted_text.strip():
                all_markdown_parts.append(extracted_text.strip())

            all_page_meta.extend(page_meta)
            pages_completed_so_far += batch_page_count
            ACTIVE_JOBS[doc_id].update({
                "pages_processed": min(total_pages, pages_completed_so_far),
            })

        final_content = "\n\n".join(all_markdown_parts).strip()
        if not final_content:
            final_content = "*No readable text was detected in this document.*"

        doc_dir = get_doc_dir(doc_id)
        ext = "html" if output_format == "html" else ("json" if output_format == "json" else "md")
        content_file = doc_dir / f"content.{ext}"
        with open(content_file, "w", encoding="utf-8") as f:
            f.write(final_content)

        meta = load_doc_meta(doc_id)
        meta.update({
            "status": "completed",
            "sarvam_job_ids": sarvam_job_ids,
            "pages_total": total_pages,
            "pages_processed": total_pages,
            "markdown": final_content,
            "word_count": count_readable_words(final_content),
            "page_metadata_count": len(all_page_meta),
            "completed_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        })
        save_doc_meta(doc_id, meta)

        ACTIVE_JOBS[doc_id].update({
            "status": "completed",
            "stage": "Conversion complete!",
            "pages_processed": total_pages,
        })

    except Exception as exc:
        err_msg = str(exc)
        ACTIVE_JOBS[doc_id] = {
            "status": "failed",
            "stage": err_msg,
            "error": err_msg,
        }
        try:
            meta = load_doc_meta(doc_id)
            meta["status"] = "failed"
            meta["error"] = err_msg
            save_doc_meta(doc_id, meta)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# API Routes: Config & Projects
# ---------------------------------------------------------------------------

@app.get("/api/config")
def get_config():
    key = get_api_key()
    return {
        "has_api_key": bool(key),
        "masked_key": mask_key(key),
        "env_file_path": str(ENV_FILE),
        "projects": load_projects(),
        "models": [
            {
                "id": "sarvam-105b",
                "name": "Sarvam-105B (Flagship Reasoning · 128K)",
                "description": "Deep contextual reasoning & 22 Indian languages + English",
            },
            {
                "id": "sarvam-105b-conversations",
                "name": "Sarvam-105B Conversations (Fast · 32K)",
                "description": "Optimized for snappy conversational Q&A",
            },
        ],
        "languages": [
            {"code": "en-IN", "name": "English (en-IN)"},
            {"code": "hi-IN", "name": "Hindi — हिन्दी (hi-IN)"},
            {"code": "bn-IN", "name": "Bengali — বাংলা (bn-IN)"},
            {"code": "ta-IN", "name": "Tamil — தமிழ் (ta-IN)"},
            {"code": "te-IN", "name": "Telugu — తెలుగు (te-IN)"},
            {"code": "mr-IN", "name": "Marathi — मराठी (mr-IN)"},
            {"code": "gu-IN", "name": "Gujarati — ગુજરાતી (gu-IN)"},
            {"code": "kn-IN", "name": "Kannada — ಕನ್ನಡ (kn-IN)"},
            {"code": "ml-IN", "name": "Malayalam — മലയാളം (ml-IN)"},
            {"code": "pa-IN", "name": "Punjabi — ਪੰਜਾਬੀ (pa-IN)"},
            {"code": "od-IN", "name": "Odia — ଓଡ଼ିଆ (od-IN)"},
            {"code": "ur-IN", "name": "Urdu — اردو (ur-IN)"},
            {"code": "as-IN", "name": "Assamese — অসমীয়া (as-IN)"},
            {"code": "sa-IN", "name": "Sanskrit — संस्कृतम् (sa-IN)"},
            {"code": "ne-IN", "name": "Nepali — नेपाली (ne-IN)"},
            {"code": "kok-IN", "name": "Konkani — कोंकणी (kok-IN)"},
            {"code": "mai-IN", "name": "Maithili — मैथिली (mai-IN)"},
            {"code": "doi-IN", "name": "Dogri — डोगरी (doi-IN)"},
            {"code": "ks-IN", "name": "Kashmiri — کٲشُر (ks-IN)"},
            {"code": "sd-IN", "name": "Sindhi — سنڌي (sd-IN)"},
            {"code": "brx-IN", "name": "Bodo — बर' (brx-IN)"},
            {"code": "mni-IN", "name": "Manipuri — মৈতৈলোন্ (mni-IN)"},
            {"code": "sat-IN", "name": "Santali — संताली (sat-IN)"},
        ],
    }


@app.post("/api/config/key")
def save_api_key(payload: ApiKeyPayload):
    clean_key = payload.api_key.strip()
    if not clean_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty.")

    if not ENV_FILE.exists():
        ENV_FILE.write_text(f"SARVAM_API_KEY={clean_key}\nPORT=8000\n", encoding="utf-8")
    else:
        set_key(str(ENV_FILE), "SARVAM_API_KEY", clean_key)
    os.environ["SARVAM_API_KEY"] = clean_key

    return {
        "ok": True,
        "has_api_key": True,
        "masked_key": mask_key(clean_key),
        "env_file_path": str(ENV_FILE),
    }


@app.get("/api/projects")
def api_get_projects():
    return {"projects": load_projects()}


@app.post("/api/projects")
def api_create_project(payload: ProjectCreatePayload):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Project name is required")
    projects = load_projects()
    new_proj = {
        "id": f"proj-{str(uuid.uuid4())[:6]}",
        "name": name,
        "color": payload.color or "#C85A32",
        "icon": payload.icon or "book",
        "created_at": datetime.now().isoformat(),
    }
    projects.append(new_proj)
    save_projects(projects)
    return {"project": new_proj, "projects": projects}


@app.patch("/api/projects/{project_id}")
def api_update_project(project_id: str, payload: ProjectUpdatePayload):
    projects = load_projects()
    target_proj = next((p for p in projects if p.get("id") == project_id), None)
    if not target_proj:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.name is not None and payload.name.strip():
        target_proj["name"] = payload.name.strip()
    if payload.color is not None and payload.color.strip():
        target_proj["color"] = payload.color.strip()
    if payload.icon is not None and payload.icon.strip():
        target_proj["icon"] = payload.icon.strip()
    target_proj["updated_at"] = datetime.now().isoformat()

    save_projects(projects)
    return {"project": target_proj, "projects": projects}


@app.delete("/api/projects/{project_id}")
def api_delete_project(project_id: str):
    if project_id == "proj-general":
        raise HTTPException(status_code=400, detail="Cannot delete default project")
    projects = load_projects()
    found = any(p.get("id") == project_id for p in projects)
    if not found:
        raise HTTPException(status_code=404, detail="Project not found")

    projects = [p for p in projects if p.get("id") != project_id]
    save_projects(projects)

    # Reassign all documents belonging to this project to 'proj-general'
    if DOCS_DIR.exists():
        for folder in DOCS_DIR.iterdir():
            if folder.is_dir() and (folder / "meta.json").exists():
                try:
                    meta = load_doc_meta(folder.name)
                    if meta.get("project_id") == project_id:
                        meta["project_id"] = "proj-general"
                        meta["updated_at"] = datetime.now().isoformat()
                        save_doc_meta(folder.name, meta)
                except Exception:
                    pass

    return {"ok": True, "projects": projects}


# ---------------------------------------------------------------------------
# API Routes: Documents & Assignments
# ---------------------------------------------------------------------------

@app.get("/api/documents")
def api_list_documents():
    return {
        "documents": list_all_docs(),
        "projects": load_projects(),
    }


@app.post("/api/documents/upload")
async def upload_and_digitise_document(
    request: Request,
    file: UploadFile = File(...),
    language: str = Form("en-IN"),
    output_format: str = Form("html"),
    project_id: str = Form("proj-general"),
    category: str = Form("Assignment"),
):
    header_key = request.headers.get("x-sarvam-api-key")
    api_key = get_api_key(header_key)
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Sarvam API key is not configured. Add SARVAM_API_KEY in .env or click 'API Key' in the top bar.",
        )

    filename = file.filename or "document.pdf"
    allowed_exts = (".pdf", ".png", ".jpg", ".jpeg", ".zip")
    if not filename.lower().endswith(allowed_exts):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Sarvam Doc AI supports: {', '.join(allowed_exts)}",
        )

    if output_format not in ("md", "html", "json"):
        output_format = "html"

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    doc_id = str(uuid.uuid4())[:12]
    doc_dir = get_doc_dir(doc_id)
    doc_dir.mkdir(parents=True, exist_ok=True)

    orig_path = doc_dir / f"original{Path(filename).suffix.lower()}"
    with open(orig_path, "wb") as f:
        f.write(file_bytes)

    pages_total = 1
    if filename.lower().endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            pages_total = len(reader.pages)
        except Exception:
            pages_total = 1

    clean_title = Path(filename).stem.replace("_", " ").replace("-", " ").strip() or "Untitled Notes"

    now_iso = datetime.now().isoformat()
    meta = {
        "id": doc_id,
        "title": clean_title,
        "filename": filename,
        "original_file": orig_path.name,
        "project_id": project_id or "proj-general",
        "category": category or "Assignment",
        "assignment_status": "in_progress",
        "starred": False,
        "language": language,
        "output_format": output_format,
        "pages_total": pages_total,
        "pages_processed": 0,
        "status": "running",
        "created_at": now_iso,
        "updated_at": now_iso,
        "markdown": "",
        "word_count": 0,
        "chats": [],
    }
    save_doc_meta(doc_id, meta)

    ACTIVE_JOBS[doc_id] = {
        "status": "running",
        "stage": "Submitting document for digitisation...",
        "pages_total": pages_total,
        "pages_processed": 0,
        "batches_total": max(1, (pages_total + 9) // 10),
        "current_batch": 1,
    }

    worker = threading.Thread(
        target=run_digitise_pipeline,
        args=(
            doc_id,
            file_bytes,
            filename,
            file.content_type or "application/pdf",
            language,
            output_format,
            api_key,
        ),
        daemon=True,
    )
    worker.start()

    return {"doc_id": doc_id, "meta": meta, "job": ACTIVE_JOBS[doc_id]}


@app.get("/api/documents/{doc_id}/status")
def get_document_job_status(doc_id: str):
    if doc_id in ACTIVE_JOBS:
        job = ACTIVE_JOBS[doc_id]
        if job.get("status") == "completed":
            meta = load_doc_meta(doc_id)
            return {"job": job, "document": meta}
        return {"job": job}

    meta = load_doc_meta(doc_id)
    return {
        "job": {
            "status": meta.get("status", "completed"),
            "stage": meta.get("error") if meta.get("status") == "failed" else "Completed",
            "pages_total": meta.get("pages_total", 1),
            "pages_processed": meta.get("pages_processed", 1),
            "error": meta.get("error"),
        },
        "document": meta if meta.get("status") == "completed" else None,
    }


@app.get("/api/documents/{doc_id}")
def get_document_detail(doc_id: str):
    return load_doc_meta(doc_id)


@app.patch("/api/documents/{doc_id}")
def update_document_notes(doc_id: str, payload: DocumentUpdatePayload):
    meta = load_doc_meta(doc_id)
    if payload.title is not None and payload.title.strip():
        meta["title"] = payload.title.strip()
    if payload.project_id is not None:
        meta["project_id"] = payload.project_id
    if payload.category is not None:
        meta["category"] = payload.category
    if payload.assignment_status is not None:
        meta["assignment_status"] = payload.assignment_status
    if payload.starred is not None:
        meta["starred"] = payload.starred
    if payload.markdown is not None:
        meta["markdown"] = payload.markdown
        meta["word_count"] = count_readable_words(payload.markdown)
        doc_dir = get_doc_dir(doc_id)
        ext = "html" if meta.get("output_format") == "html" else "md"
        with open(doc_dir / f"content.{ext}", "w", encoding="utf-8") as f:
            f.write(payload.markdown)

    meta["updated_at"] = datetime.now().isoformat()
    save_doc_meta(doc_id, meta)
    return meta


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str):
    doc_dir = get_doc_dir(doc_id)
    if doc_dir.exists():
        shutil.rmtree(doc_dir, ignore_errors=True)
    ACTIVE_JOBS.pop(doc_id, None)
    return {"ok": True}


@app.get("/api/documents/{doc_id}/original")
def get_original_file(doc_id: str):
    meta = load_doc_meta(doc_id)
    orig_name = meta.get("original_file", "original.pdf")
    orig_path = get_doc_dir(doc_id) / orig_name
    if not orig_path.exists():
        raise HTTPException(status_code=404, detail="Original file not found")
    orig_lower = orig_name.lower()
    if orig_lower.endswith(".pdf"):
        media_type = "application/pdf"
    elif orig_lower.endswith(".png"):
        media_type = "image/png"
    elif orig_lower.endswith((".jpg", ".jpeg")):
        media_type = "image/jpeg"
    elif orig_lower.endswith(".webp"):
        media_type = "image/webp"
    else:
        media_type = "application/octet-stream"
    return FileResponse(
        orig_path,
        media_type=media_type,
        headers={"Content-Disposition": "inline"},
    )


@app.get("/api/documents/{doc_id}/pdf-bytes")
def get_pdf_bytes(doc_id: str):
    """Returns raw binary bytes as application/octet-stream for PDF.js canvas rendering (never triggers browser PDF download)."""
    meta = load_doc_meta(doc_id)
    orig_name = meta.get("original_file", "original.pdf")
    orig_path = get_doc_dir(doc_id) / orig_name
    if not orig_path.exists():
        raise HTTPException(status_code=404, detail="Original file not found")
    return FileResponse(
        orig_path,
        media_type="application/octet-stream",
        headers={"X-Content-Type-Options": "nosniff"},
    )


# ---------------------------------------------------------------------------
# API Routes: Multi-Chat Threads & Global Past Chats History
# ---------------------------------------------------------------------------

@app.get("/api/chats")
def api_list_all_chats():
    return {"chats": list_all_global_chats()}


@app.post("/api/documents/{doc_id}/chats")
def api_create_chat_thread(doc_id: str, payload: ChatThreadCreatePayload):
    meta = load_doc_meta(doc_id)
    now_iso = datetime.now().isoformat()
    new_thread = {
        "id": f"chat-{str(uuid.uuid4())[:8]}",
        "title": (payload.title or "New Doubt Session").strip(),
        "created_at": now_iso,
        "updated_at": now_iso,
        "messages": [],
    }
    chats = meta.get("chats", [])
    chats.insert(0, new_thread)
    meta["chats"] = chats
    meta["updated_at"] = now_iso
    save_doc_meta(doc_id, meta)
    return {"chat": new_thread, "chats": chats}


@app.patch("/api/documents/{doc_id}/chats/{chat_id}")
def api_rename_chat_thread(doc_id: str, chat_id: str, payload: ChatThreadRenamePayload):
    meta = load_doc_meta(doc_id)
    for c in meta.get("chats", []):
        if c.get("id") == chat_id:
            c["title"] = payload.title.strip() or "Doubt Session"
            c["updated_at"] = datetime.now().isoformat()
            save_doc_meta(doc_id, meta)
            return {"chat": c, "chats": meta["chats"]}
    raise HTTPException(status_code=404, detail="Chat thread not found")


@app.delete("/api/documents/{doc_id}/chats/{chat_id}")
def api_delete_chat_thread(doc_id: str, chat_id: str):
    meta = load_doc_meta(doc_id)
    meta["chats"] = [c for c in meta.get("chats", []) if c.get("id") != chat_id]
    save_doc_meta(doc_id, meta)
    return {"ok": True, "chats": meta["chats"]}


@app.post("/api/documents/{doc_id}/chats/restore")
def api_restore_chat_thread(doc_id: str, payload: ChatThreadRestorePayload):
    meta = load_doc_meta(doc_id)
    now_iso = datetime.now().isoformat()
    data = payload.dict()
    restored_thread = {
        "id": data.get("id"),
        "title": (data.get("title") or "Restored Doubt Session").strip(),
        "created_at": data.get("created_at") or now_iso,
        "updated_at": data.get("updated_at") or now_iso,
        "messages": data.get("messages") or [],
    }
    chats = meta.get("chats", [])
    idx = next((i for i, c in enumerate(chats) if c.get("id") == restored_thread["id"]), None)
    if idx is not None:
        chats[idx] = restored_thread
    else:
        chats.insert(0, restored_thread)
    meta["chats"] = chats
    meta["updated_at"] = now_iso
    save_doc_meta(doc_id, meta)
    return {"ok": True, "chat": restored_thread, "chats": chats}


# ---------------------------------------------------------------------------
# Sarvam-105B Doubt Solving with Multi-Thread Context
# ---------------------------------------------------------------------------

def strip_base64_for_llm_context(raw_content: str) -> str:
    """
    Removes huge base64 image strings from HTML while preserving image `alt` descriptions
    (Sarvam Vision puts rich diagram descriptions in `alt="..."`!) and all text/LaTeX equations.
    """
    if not raw_content:
        return ""
    # Replace <img src="data:image/..." alt="DESCRIPTION" ...> with [Diagram: DESCRIPTION]
    def img_to_desc(match: re.Match) -> str:
        tag = match.group(0)
        alt_m = re.search(r'alt=["\'](.*?)["\']', tag, flags=re.DOTALL)
        if alt_m and alt_m.group(1).strip():
            return f"\n[Diagram / Figure Description: {html.unescape(alt_m.group(1).strip())}]\n"
        return "\n[Embedded Diagram]\n"

    cleaned = re.sub(r"<img[^>]+src=[\"']data:image/[^\"']+[\"'][^>]*>", img_to_desc, raw_content, flags=re.DOTALL)
    # Strip remaining HTML tags but keep text and math
    cleaned = re.sub(r"</?(?:div|p|span|header|figure|section|br|hr)[^>]*>", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return html.unescape(cleaned).strip()


def build_sarvam_chat_messages(
    meta: Dict[str, Any],
    thread_messages: List[Dict[str, Any]],
    user_message: str,
    selected_excerpt: Optional[str] = None,
) -> List[Dict[str, str]]:
    doc_title = meta.get("title", "Study Notes")
    doc_content = strip_base64_for_llm_context(meta.get("markdown", ""))

    max_chars = 220_000
    if len(doc_content) > max_chars:
        doc_content = doc_content[:max_chars] + "\n\n[...Document truncated to fit context window...]"

    system_prompt = (
        f"You are an insightful, rigorous academic tutor powered by Sarvam AI. "
        f"The student is working on a document/assignment titled \"{doc_title}\".\n\n"
        f"Here is the complete digitized content of their document (including text, LaTeX equations, and diagram descriptions extracted by Sarvam Vision 1.5):\n"
        f"<document_content>\n{doc_content}\n</document_content>\n\n"
        f"Guidelines for answering doubts:\n"
        f"1. Ground your answers directly in <document_content>. Reference specific problems, steps, equations, or diagrams from the notes.\n"
        f"2. When writing mathematical derivations or formulas, ALWAYS use clean LaTeX math delimiters: `$inline$` for inline math and `$$block$$` on its own line for display equations. Never wrap LaTeX math inside code backticks.\n"
        f"3. If a handwritten step in the student's assignment has a subtle error or jumps steps, explain the intermediate steps clearly and kindly.\n"
        f"4. Respond in the same language the student asks in (supporting English and all 22 Indian languages natively)."
    )

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]

    for turn in thread_messages[-12:]:
        role = turn.get("role")
        content = turn.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    if selected_excerpt and selected_excerpt.strip():
        full_user_prompt = (
            f"I highlighted this specific part from the document:\n"
            f"> {selected_excerpt.strip()}\n\n"
            f"My doubt/question: {user_message.strip()}"
        )
    else:
        full_user_prompt = user_message.strip()

    messages.append({"role": "user", "content": full_user_prompt})
    return messages


@app.post("/api/chat/stream")
async def chat_with_sarvam_stream(payload: ChatRequest, request: Request):
    header_key = request.headers.get("x-sarvam-api-key")
    api_key = get_api_key(header_key)
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Sarvam API key is missing. Please add SARVAM_API_KEY in .env or via the top-right API Key button.",
        )

    meta = load_doc_meta(payload.doc_id)
    chats = meta.get("chats", [])

    # Find or create active chat thread
    target_thread = None
    if payload.chat_id:
        target_thread = next((c for c in chats if c.get("id") == payload.chat_id), None)

    if not target_thread:
        now_iso = datetime.now().isoformat()
        clean_q = payload.message.strip()
        auto_title = (clean_q[:44] + "...") if len(clean_q) > 44 else clean_q
        target_thread = {
            "id": payload.chat_id or f"chat-{str(uuid.uuid4())[:8]}",
            "title": auto_title,
            "created_at": now_iso,
            "updated_at": now_iso,
            "messages": [],
        }
        chats.insert(0, target_thread)
        meta["chats"] = chats
        save_doc_meta(payload.doc_id, meta)

    active_chat_id = target_thread["id"]
    messages = build_sarvam_chat_messages(
        meta,
        target_thread.get("messages", []),
        payload.message,
        payload.selected_excerpt,
    )

    model_id = payload.model if payload.model in ("sarvam-105b", "sarvam-105b-conversations") else "sarvam-105b"

    body: Dict[str, Any] = {
        "model": model_id,
        "messages": messages,
        "temperature": payload.temperature,
        "max_tokens": 4096,
        "stream": True,
    }

    if model_id == "sarvam-105b":
        if payload.reasoning_effort in ("low", "medium", "high"):
            body["reasoning_effort"] = payload.reasoning_effort
        else:
            body["reasoning_effort"] = None

    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json",
    }

    def event_generator():
        full_answer = []
        full_reasoning = []
        # Immediately emit the resolved chat_id so the frontend stays synced
        yield f"data: {json.dumps({'chat_id': active_chat_id})}\n\n"
        try:
            with requests.post(
                CHAT_COMPLETIONS_V1_URL,
                headers=headers,
                json=body,
                stream=True,
                timeout=120,
            ) as resp:
                if resp.status_code != 200:
                    err_text = resp.text
                    try:
                        err_json = resp.json()
                        err_text = err_json.get("error", {}).get("message") or err_json.get("detail") or resp.text
                    except Exception:
                        pass
                    yield f"data: {json.dumps({'error': f'Sarvam Chat API error ({resp.status_code}): {err_text}'})}\n\n"
                    return

                for raw_line in resp.iter_lines(decode_unicode=True):
                    if not raw_line:
                        continue
                    line = raw_line.strip()
                    if not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        choices = chunk.get("choices") or []
                        if choices:
                            delta = choices[0].get("delta") or {}
                            reasoning_piece = delta.get("reasoning") or delta.get("reasoning_content")
                            content_piece = delta.get("content")
                            if reasoning_piece:
                                full_reasoning.append(reasoning_piece)
                                yield f"data: {json.dumps({'reasoning_delta': reasoning_piece})}\n\n"
                            if content_piece:
                                full_answer.append(content_piece)
                                yield f"data: {json.dumps({'content_delta': content_piece})}\n\n"
                        if chunk.get("usage"):
                            yield f"data: {json.dumps({'usage': chunk['usage']})}\n\n"
                    except Exception:
                        continue

            final_text = "".join(full_answer).strip()
            final_reasoning = "".join(full_reasoning).strip()
            if final_text:
                latest_meta = load_doc_meta(payload.doc_id)
                latest_chats = latest_meta.get("chats", [])
                thread = next((c for c in latest_chats if c.get("id") == active_chat_id), None)
                now_iso = datetime.now().isoformat()
                if not thread:
                    thread = {
                        "id": active_chat_id,
                        "title": payload.message.strip()[:44],
                        "created_at": now_iso,
                        "updated_at": now_iso,
                        "messages": [],
                    }
                    latest_chats.insert(0, thread)

                # Auto-update default title on first user message
                if len(thread.get("messages", [])) == 0 and thread.get("title") in ("New Doubt Session", "General Doubts", ""):
                    clean_q = payload.message.strip()
                    thread["title"] = (clean_q[:44] + "...") if len(clean_q) > 44 else clean_q

                thread["messages"].append({
                    "id": str(uuid.uuid4())[:8],
                    "role": "user",
                    "content": payload.message.strip(),
                    "selected_excerpt": payload.selected_excerpt,
                    "timestamp": now_iso,
                })
                thread["messages"].append({
                    "id": str(uuid.uuid4())[:8],
                    "role": "assistant",
                    "content": final_text,
                    "reasoning": final_reasoning or None,
                    "model": model_id,
                    "timestamp": now_iso,
                })
                thread["updated_at"] = now_iso
                # Move active thread to top of list
                latest_chats = [thread] + [c for c in latest_chats if c.get("id") != active_chat_id]
                latest_meta["chats"] = latest_chats
                latest_meta["updated_at"] = now_iso
                save_doc_meta(payload.doc_id, latest_meta)

            yield "data: [DONE]\n\n"

        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Static Frontend Mount
# ---------------------------------------------------------------------------

STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/")
def serve_index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"\n  Patra — Sarvam Study Desk running locally at: http://localhost:{port}")
    print(f"  API Key file location: {ENV_FILE}\n")
    uvicorn.run("app:app", host="127.0.0.1", port=port, reload=False)
