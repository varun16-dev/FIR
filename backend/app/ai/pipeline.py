"""AI Document Intelligence Pipeline

Modular AI pipeline for document processing:
- Text extraction (PDF, DOCX, TXT, images)
- OCR for images (Pillow-based fallback)
- Document classification (keyword-based + ML ready)
- Entity extraction (regex-based NLP)
- Anomaly detection (rule-based + IsolationForest ready)
- Summary generation (extractive)
"""
import re
import json
import io
from datetime import datetime
from typing import Optional
from collections import Counter


# --- Text Extraction ---
def extract_text(file_bytes: bytes, mime_type: str, filename: str) -> str:
    """Extract text from document based on MIME type."""
    text = ""
    lower = filename.lower()

    try:
        if mime_type == "application/pdf" or lower.endswith(".pdf"):
            text = _extract_pdf(file_bytes)
        elif mime_type in ("application/vnd.openxmlformats-officedocument.wordprocessingml.document",) or lower.endswith(".docx"):
            text = _extract_docx(file_bytes)
        elif mime_type.startswith("text/") or lower.endswith(".txt"):
            text = file_bytes.decode("utf-8", errors="ignore")
        elif mime_type.startswith("image/") or lower.endswith((".png", ".jpg", ".jpeg")):
            text = ocr_document(file_bytes)
    except Exception as e:
        text = f"[Extraction error: {str(e)}]"

    return text.strip()


def _extract_pdf(data: bytes) -> str:
    """Extract text from PDF using PyMuPDF."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=data, filetype="pdf")
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return "\n".join(text_parts)
    except ImportError:
        return "[PyMuPDF not available - PDF text extraction skipped]"


def _extract_docx(data: bytes) -> str:
    """Extract text from DOCX using python-docx."""
    try:
        from docx import Document
        doc = Document(io.BytesIO(data))
        return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
    except ImportError:
        return "[python-docx not available - DOCX extraction skipped]"


# --- OCR ---
def ocr_document(file_bytes: bytes) -> str:
    """Perform OCR on image. Uses Tesseract if available, else returns placeholder."""
    try:
        from PIL import Image
        import pytesseract
        img = Image.open(io.BytesIO(file_bytes))
        return pytesseract.image_to_string(img)
    except ImportError:
        return "[OCR: Tesseract not available - image text extraction skipped]"
    except Exception as e:
        return f"[OCR error: {str(e)}]"


# --- Document Classification ---
CLASSIFICATION_KEYWORDS = {
    "FIR": ["first information report", "fir", "complaint registered", "cognizable offence", "police station"],
    "FORENSIC_REPORT": ["forensic", "analysis report", "laboratory", "dna", "fingerprint", "ballistic", "toxicology"],
    "MEDICAL_REPORT": ["medical", "hospital", "diagnosis", "patient", "treatment", "injury report", "autopsy", "postmortem"],
    "COURT_DOCUMENT": ["court", "judgment", "order", "petition", "affidavit", "summons", "warrant", "bail"],
    "IDENTITY_DOCUMENT": ["aadhaar", "passport", "driving license", "voter id", "pan card", "identity"],
    "INVESTIGATION_REPORT": ["investigation", "suspect", "witness statement", "interrogation", "surveillance", "crime scene"],
    "EVIDENCE": ["evidence", "exhibit", "seized", "recovered", "chain of custody"],
}


def classify_document(text: str, filename: str = "") -> tuple:
    """Classify document using keyword matching. Returns (category, confidence)."""
    if not text:
        return "OTHER", 0.1

    text_lower = text.lower()
    filename_lower = filename.lower()
    scores = {}

    for category, keywords in CLASSIFICATION_KEYWORDS.items():
        score = 0
        for kw in keywords:
            count = text_lower.count(kw)
            if count > 0:
                score += count * (2 if len(kw) > 6 else 1)
            if kw in filename_lower:
                score += 3
        if score > 0:
            scores[category] = score

    if not scores:
        return "OTHER", 0.15

    best = max(scores, key=scores.get)
    total = sum(scores.values())
    confidence = min(0.95, scores[best] / max(total, 1) * 0.8 + 0.15)
    return best, round(confidence, 2)


# --- Entity Extraction ---
ENTITY_PATTERNS = {
    "PERSON": [
        r'\b(?:Mr|Mrs|Ms|Dr|Prof|Shri|Smt|Inspector|Officer|Constable|SI|ASI|DSP|SP|DIG|IG|Commissioner)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b',
    ],
    "DATE": [
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b',
        r'\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b',
        r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b',
    ],
    "LOCATION": [
        r'\b(?:District|City|Town|Village|State|Police Station|P\.S\.|Thana)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b',
    ],
    "CASE_NUMBER": [
        r'\b(?:CASE|FIR|CR|CC)\s*[-#]?\s*\d+[/-]\d+\b',
        r'\bCASE-\d{4}-\d+\b',
    ],
    "PHONE": [
        r'\b(?:\+91|0)?[6-9]\d{9}\b',
    ],
    "EMAIL": [
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    ],
    "DOCUMENT_NUMBER": [
        r'\bEV-\d{4}-\d+\b',
        r'\b[A-Z]{2,4}[-/]\d{4,}\b',
    ],
}


def extract_entities(text: str) -> list:
    """Extract entities using regex patterns."""
    if not text:
        return []

    entities = []
    seen = set()

    for entity_type, patterns in ENTITY_PATTERNS.items():
        for pattern in patterns:
            try:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for m in matches:
                    value = m.group().strip()
                    key = (entity_type, value.lower())
                    if key not in seen and len(value) > 2:
                        seen.add(key)
                        entities.append({
                            "type": entity_type,
                            "value": value,
                            "start": m.start(),
                            "end": m.end(),
                        })
            except re.error:
                continue

    return entities[:50]  # Limit to top 50 entities


# --- Anomaly Detection ---
def detect_anomalies(evidence_data: dict) -> list:
    """Detect suspicious patterns in evidence metadata."""
    anomalies = []

    # Check hash mismatch
    if evidence_data.get("stored_hash") and evidence_data.get("current_hash"):
        if evidence_data["stored_hash"] != evidence_data["current_hash"]:
            anomalies.append({
                "type": "HASH_MISMATCH",
                "severity": "HIGH",
                "message": "Document hash does not match stored hash - possible tampering",
            })

    # Check unusual version changes
    version = evidence_data.get("current_version", 1)
    if version > 5:
        anomalies.append({
            "type": "EXCESSIVE_VERSIONS",
            "severity": "MEDIUM",
            "message": f"Evidence has {version} versions - unusual modification frequency",
        })

    # Metadata consistency
    file_size = evidence_data.get("file_size", 0)
    if file_size == 0:
        anomalies.append({
            "type": "ZERO_SIZE",
            "severity": "HIGH",
            "message": "File size is zero - possible corruption",
        })

    # Upload timing
    created = evidence_data.get("created_at")
    if created:
        try:
            if isinstance(created, str):
                created = datetime.fromisoformat(created)
            if created.hour < 4 or created.hour > 23:
                anomalies.append({
                    "type": "UNUSUAL_TIMING",
                    "severity": "LOW",
                    "message": f"Evidence uploaded at unusual hour ({created.hour}:00)",
                })
        except (ValueError, TypeError):
            pass

    return anomalies


def calculate_risk_score(anomalies: list) -> tuple:
    """Calculate risk score and level from anomalies."""
    if not anomalies:
        return 5.0, "LOW"

    severity_scores = {"HIGH": 35, "MEDIUM": 20, "LOW": 10}
    total = sum(severity_scores.get(a.get("severity", "LOW"), 5) for a in anomalies)
    score = min(100, total)

    if score >= 70:
        level = "HIGH"
    elif score >= 40:
        level = "MEDIUM"
    else:
        level = "LOW"

    return score, level


# --- Summary Generation ---
def generate_summary(text: str, doc_type: str, entities: list, max_length: int = 300) -> str:
    """Generate an extractive summary from document text."""
    if not text or text.startswith("["):
        return "No text content available for summary generation."

    # Clean text
    clean = re.sub(r'\s+', ' ', text).strip()
    sentences = re.split(r'[.!?]+', clean)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]

    if not sentences:
        return f"Document classified as {doc_type}. Content could not be summarized."

    # Score sentences by keyword relevance
    important_words = set()
    for entity in entities:
        important_words.update(entity.get("value", "").lower().split())

    scored = []
    for i, sent in enumerate(sentences[:30]):  # Process first 30 sentences
        score = 0
        # Position bonus (first sentences tend to be more important)
        score += max(0, 5 - i) * 2
        # Entity word overlap
        words = set(sent.lower().split())
        score += len(words & important_words) * 3
        # Length preference
        if 30 < len(sent) < 200:
            score += 2
        scored.append((score, i, sent))

    scored.sort(reverse=True)
    # Take top 3 sentences in original order
    selected = sorted(scored[:3], key=lambda x: x[1])
    summary_text = ". ".join(s[2] for s in selected)

    if len(summary_text) > max_length:
        summary_text = summary_text[:max_length].rsplit(" ", 1)[0] + "..."

    return f"Document classified as {doc_type}. {summary_text}"


# --- Full Pipeline ---
def run_pipeline(file_bytes: bytes, mime_type: str, filename: str,
                 evidence_data: dict = None) -> dict:
    """Run the complete AI analysis pipeline."""

    # Step 1: Text extraction
    text = extract_text(file_bytes, mime_type, filename)

    # Step 2: Classification
    doc_type, confidence = classify_document(text, filename)

    # Step 3: Entity extraction
    entities = extract_entities(text)

    # Step 4: Anomaly detection
    anomalies = detect_anomalies(evidence_data or {})
    risk_score, risk_level = calculate_risk_score(anomalies)

    # Step 5: Summary
    summary = generate_summary(text, doc_type, entities)

    # Count entity types
    entity_counts = Counter(e["type"] for e in entities)

    return {
        "extracted_text": text[:10000],  # Cap stored text
        "document_type": doc_type,
        "confidence": confidence,
        "entities": entities,
        "summary": summary,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "anomalies": anomalies,
        "key_persons_count": entity_counts.get("PERSON", 0),
        "locations_count": entity_counts.get("LOCATION", 0),
        "dates_count": entity_counts.get("DATE", 0),
        "case_references_count": entity_counts.get("CASE_NUMBER", 0),
        "classification_method": "keyword",
    }
