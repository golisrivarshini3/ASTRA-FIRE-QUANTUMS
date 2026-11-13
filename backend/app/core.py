from __future__ import annotations

from pathlib import Path
import re
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

DATA = Path(__file__).resolve().parents[1] / "data" / "investigations.csv"

TOPICS = {
    "Material flammability": ["material", "solid", "flammability", "saffire", "bass", "spice", "slice", "bre"],
    "Smoke detection": ["smoke", "sensor", "same", "aerosol", "detection"],
    "Flame suppression": ["extinguish", "suppression", "flex", "carbon dioxide", "helium"],
    "Gaseous-fuel combustion": ["gaseous", "gas", "flame", "burner", "co-flow", "cfi-g"],
    "Liquid-fuel droplets": ["droplet", "liquid", "cfi", "fuel droplet", "cool flame"],
}

def catalog() -> pd.DataFrame:
    return pd.read_csv(DATA).fillna("")

def rank_catalog(df: pd.DataFrame, focus: list[str] | None = None) -> list[dict]:
    """Transparent metadata relevance score; not an official NASA ranking."""
    focus = focus or list(TOPICS)
    valid_focus = [topic for topic in focus if topic in TOPICS]
    if not valid_focus:
        valid_focus = list(TOPICS)
    out = []
    for row in df.to_dict(orient="records"):
        text = " ".join(str(row.get(k, "")) for k in [
            "name", "objective", "domain", "fuel_or_subject", "hardware", "conditions", "measurements", "notes"
        ]).lower()
        matched = []
        for topic in valid_focus:
            terms = TOPICS[topic]
            if any(term in text for term in terms):
                matched.append(topic)
        metadata_fields = ["fuel_or_subject", "hardware", "conditions", "measurements"]
        known = sum(
            bool(str(row.get(k, "")).strip())
            and str(row.get(k, "")).lower() not in {"unknown", "not specified"}
            for k in metadata_fields
        )
        topic_score = len(matched) / len(valid_focus)
        metadata_score = known / len(metadata_fields)
        score = round(100 * (0.8 * topic_score + 0.2 * metadata_score), 1)
        out.append({
            **row,
            "relevance_score": score,
            "confidence": "Medium" if known >= 3 else "Low",
            "matched_topics": matched,
            "score_breakdown": {
                "topic_match_percent": round(topic_score * 100, 1),
                "metadata_completeness_percent": round(metadata_score * 100, 1),
                "weights": {"topic_match": 0.8, "metadata_completeness": 0.2},
            },
            "explanation": (
                ("Matched: " + ", ".join(matched) + ". ") if matched else "No selected topic matched strongly. "
            ) + f"{known}/4 metadata fields are populated. Score is a prototype heuristic, not an official NASA score."
        })
    return sorted(out, key=lambda x: (-x["relevance_score"], x["name"]))

def _chunks(text: str, size: int = 1100, overlap: int = 160) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(len(text), start + size)
        if end < len(text):
            boundary = text.rfind(". ", start + size // 2, end)
            if boundary > start:
                end = boundary + 1
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(start + 1, end - overlap)
    return chunks

def retrieve(query: str, limit: int = 5) -> list[dict]:
    """Retrieve investigation metadata with a simple weighted lexical match."""
    terms = [t for t in re.findall(r"[a-zA-Z0-9-]+", query.lower()) if len(t) > 2]
    aliases = {
        "cool flames": ["cool-flame", "low-temperature", "flex", "cfi", "droplet"],
        "cool flame": ["cool-flame", "low-temperature", "flex", "cfi", "droplet"],
        "hcci": ["cool-flame", "low-temperature", "combustion"],
        "smoke": ["same", "same-r", "aerosol"],
        "lunar": ["partial gravity", "habitat", "oxygen"],
    }
    expanded = list(terms)
    qlower = query.lower()
    for phrase, extra in aliases.items():
        if phrase in qlower:
            expanded.extend(extra)
    hits = []
    for row in catalog().to_dict(orient="records"):
        fields = {
            "name": str(row.get("name", "")).lower(),
            "objective": str(row.get("objective", "")).lower(),
            "domain": str(row.get("domain", "")).lower(),
            "subject": str(row.get("fuel_or_subject", "")).lower(),
            "hardware": str(row.get("hardware", "")).lower(),
            "notes": str(row.get("notes", "")).lower(),
        }
        score = 0
        for term in set(expanded):
            if term in fields["name"]: score += 4
            if term in fields["objective"]: score += 3
            if term in fields["domain"]: score += 2
            if term in fields["subject"] or term in fields["hardware"]: score += 1
            if term in fields["notes"]: score += 1
        if score:
            hits.append((score, row))
    hits.sort(key=lambda x: (-x[0], x[1].get("name", "")))
    return [{"match_score": score, **row} for score, row in hits[:limit]]

def retrieve_document_passages(query: str, documents: list, limit: int = 5) -> list[dict]:
    """Rank document passages rather than entire files, preserving source provenance."""
    passages = []
    for doc in documents:
        for index, chunk in enumerate(_chunks(doc.content)):
            passages.append({
                "id": f"DOC-{doc.id}-P{index+1}",
                "name": doc.filename,
                "objective": chunk,
                "domain": "Uploaded research document",
                "fuel_or_subject": "See source passage",
                "hardware": "See source passage",
                "conditions": "See source passage",
                "measurements": "See source passage",
                "source_url": doc.source,
                "evidence_status": "Extracted document passage; verify against original PDF",
                "notes": f"Passage {index+1}",
            })
    if not passages:
        return []
    corpus = [p["objective"] for p in passages]
    try:
        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=30000)
        matrix = vectorizer.fit_transform(corpus + [query])
        sims = cosine_similarity(matrix[-1], matrix[:-1]).flatten()
    except ValueError:
        return []
    order = sims.argsort()[::-1]
    results = []
    for idx in order:
        if sims[idx] < 0.015:
            continue
        item = dict(passages[int(idx)])
        item["match_score"] = round(float(sims[idx]), 4)
        results.append(item)
        if len(results) >= limit:
            break
    return results

def oxygen_partial_pressure(oxygen_percent: float, total_pressure_kpa: float) -> dict:
    if not 0 <= oxygen_percent <= 100:
        raise ValueError("Oxygen percentage must be between 0 and 100.")
    if total_pressure_kpa <= 0:
        raise ValueError("Total pressure must be greater than zero.")
    return {
        "oxygen_fraction": oxygen_percent / 100,
        "total_pressure_kpa": total_pressure_kpa,
        "oxygen_partial_pressure_kpa": oxygen_percent / 100 * total_pressure_kpa,
    }
