import os, json, tempfile, pathlib, math
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import cv2
import numpy as np
import pandas as pd
import requests
import fitz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from .core import catalog, rank_catalog, retrieve, retrieve_document_passages, oxygen_partial_pressure
from .db import init_db, SessionLocal, InvestigationRecord, DatasetRecord, ResearchDocument
from .science import dimensionless_numbers

app = FastAPI(title="ASTRA-FIRE API", version="2.2.0",
              description="Evidence-first space combustion research, datasets and image/video analysis.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if x.strip()],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()
    # Seed the persistent investigation table from the bundled starter catalog once.
    with SessionLocal() as db:
        if db.scalar(select(InvestigationRecord.id).limit(1)) is None:
            for row in catalog().to_dict(orient="records"):
                db.add(InvestigationRecord(**{k: str(v) for k,v in row.items()}))
            db.commit()

class RankRequest(BaseModel):
    focus: list[str] = Field(default_factory=lambda: ["Material flammability","Smoke detection","Flame suppression"])
class AtmosphereRequest(BaseModel):
    oxygen_percent: float = Field(ge=0, le=100)
    total_pressure_kpa: float = Field(gt=0)
class AssistantRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    use_local_model: bool = False
class PhysicsRequest(BaseModel):
    length_m: float = Field(gt=0)
    velocity_m_s: float = Field(ge=0)
    delta_temp_k: float = Field(ge=0)
    temperature_k: float = Field(gt=0)
    gravity_m_s2: float = Field(ge=0)
    nu_m2_s: float = Field(gt=0)
    alpha_m2_s: float = Field(gt=0)
    beta_1_k: float = Field(gt=0)

@app.get("/api/health")
def health():
    return {"status":"ok","service":"astra-fire-api","version":"2.2.0"}

@app.get("/api/overview")
def overview():
    df = catalog()
    return {"investigation_count":int(len(df)),"domain_count":int(df["domain"].nunique()),
            "domains":df["domain"].value_counts().to_dict(),
            "partial_gravity_data":"Not identified in supplied challenge material"}

@app.get("/api/investigations")
def investigations(q: Optional[str]=None, domain: Optional[str]=None):
    with SessionLocal() as db:
        rows = db.scalars(select(InvestigationRecord)).all()
        items = [{c:getattr(r,c) for c in ["id","name","domain","objective","fuel_or_subject","hardware","conditions","measurements","evidence_status","source_url","notes"]} for r in rows]
    df = pd.DataFrame(items)
    if q:
        mask = df.astype(str).apply(lambda col:col.str.contains(q,case=False,na=False)).any(axis=1)
        df=df[mask]
    if domain:
        df=df[df["domain"].str.lower()==domain.lower()]
    return df.to_dict(orient="records")

@app.post("/api/rank")
def rank(request: RankRequest):
    return rank_catalog(pd.DataFrame([x for x in investigations()]), request.focus)

@app.post("/api/atmosphere")
def atmosphere(request: AtmosphereRequest):
    try: return oxygen_partial_pressure(request.oxygen_percent,request.total_pressure_kpa)
    except ValueError as exc: raise HTTPException(status_code=422,detail=str(exc))

@app.post("/api/physics/dimensionless")
def physics(request: PhysicsRequest):
    try: return dimensionless_numbers(**request.model_dump())
    except ValueError as exc: raise HTTPException(status_code=422,detail=str(exc))

@app.post("/api/assistant")
def assistant(request: AssistantRequest):
    catalog_docs = retrieve(request.question, limit=5)
    with SessionLocal() as db:
        stored = db.scalars(select(ResearchDocument)).all()
        document_docs = retrieve_document_passages(request.question, stored, limit=5)
    docs = sorted(
        catalog_docs + document_docs,
        key=lambda d: float(d.get("match_score", 0)),
        reverse=True,
    )[:8]
    if not docs:
        return {
            "answer": "I could not find sufficiently relevant evidence in the current investigation catalog or uploaded documents. Add a relevant NASA source document and try again.",
            "sources": [],
            "mode": "retrieval-only",
        }

    context_parts = []
    for index, doc in enumerate(docs, start=1):
        passage = doc.get("objective", "")
        context_parts.append(
            f"[S{index}] {doc.get('name','Unknown source')} | "
            f"Description/evidence: {passage} | "
            f"Conditions: {doc.get('conditions','Not specified')} | "
            f"Measurements: {doc.get('measurements','Not specified')} | "
            f"Source: {doc.get('source_url','Not supplied')}"
        )
        doc["citation_id"] = f"S{index}"

    if request.use_local_model:
        base = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        model = os.getenv("OLLAMA_MODEL", "qwen3.5:9b")
        prompt = (
            "You are ASTRA-FIRE, a careful scientific research assistant. Answer using ONLY the evidence below. "
            "Cite every factual paragraph with [S1] style source IDs. Never invent numerical measurements, "
            "experimental conditions, paper titles, or NASA conclusions. If evidence is insufficient, say exactly "
            "what is missing. Separate established experimental observations from interpretation and potential "
            "applications. Explicitly distinguish microgravity from partial gravity. Do not infer that a study "
            "measured something merely because it is relevant to the topic. Use concise headings.\n\n"
            f"QUESTION:\n{request.question}\n\nEVIDENCE:\n" + "\n\n".join(context_parts)
        )
        try:
            res = requests.post(
                f"{base}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False, "options": {"temperature": 0.15}},
                timeout=150,
            )
            res.raise_for_status()
            answer = res.json().get("response", "").strip()
            if answer:
                return {"answer": answer, "sources": docs, "mode": "ollama", "model": model}
            return {"answer": "The local model returned an empty response. The retrieved evidence is available below.", "sources": docs, "mode": "retrieval-only"}
        except requests.RequestException as exc:
            return {
                "answer": f"Local Ollama generation could not be completed ({exc.__class__.__name__}). The relevant retrieved evidence is shown below; check that Ollama is running and that the selected model is available.",
                "sources": docs,
                "mode": "retrieval-only",
            }

    return {
        "answer": "Relevant evidence has been retrieved. Enable the local Ollama option to generate an evidence-grounded synthesis. Retrieved passages are not, by themselves, a scientific conclusion.",
        "sources": docs,
        "mode": "retrieval-only",
    }

@app.post("/api/documents/upload")
async def upload_document(file: UploadFile=File(...), source: str=Form("")):
    name=pathlib.Path(file.filename or "uploaded-document").name
    raw=await file.read()
    if len(raw)>25*1024*1024: raise HTTPException(status_code=413,detail="Maximum document size is 25 MB.")
    suffix=pathlib.Path(name).suffix.lower()
    text=""
    if suffix==".pdf":
        try:
            doc=fitz.open(stream=raw,filetype="pdf")
            text="\n".join(page.get_text() for page in doc)
        except Exception: raise HTTPException(status_code=400,detail="Could not parse PDF.")
    elif suffix in {".txt",".md"}:
        text=raw.decode("utf-8",errors="replace")
    else:
        raise HTTPException(status_code=415,detail="Supported formats: PDF, TXT, MD.")
    text=" ".join(text.split())
    if len(text)<40: raise HTTPException(status_code=400,detail="No usable text extracted.")
    with SessionLocal() as db:
        item=ResearchDocument(filename=name,content=text,source=source or name)
        db.add(item);db.commit();db.refresh(item)
        return {"id":item.id,"filename":name,"characters":len(text),"message":"Document indexed for lexical retrieval."}

@app.get("/api/documents")
def documents():
    with SessionLocal() as db:
        rows=db.scalars(select(ResearchDocument)).all()
        return [{"id":r.id,"filename":r.filename,"source":r.source,"characters":len(r.content)} for r in rows]

@app.post("/api/datasets/import")
async def import_dataset(file: UploadFile=File(...), title: str=Form("Uploaded experimental dataset"),
                         investigation_id: str=Form("UNLINKED"), provenance: str=Form("")):
    name=pathlib.Path(file.filename or "dataset.csv").name
    raw=await file.read()
    if len(raw)>30*1024*1024: raise HTTPException(status_code=413,detail="Maximum dataset size is 30 MB.")
    if pathlib.Path(name).suffix.lower() not in {".csv"}:
        raise HTTPException(status_code=415,detail="Currently supports CSV only.")
    try:
        from io import BytesIO
        frame=pd.read_csv(BytesIO(raw))
    except Exception as exc: raise HTTPException(status_code=400,detail=f"CSV parse failed: {exc}")
    if frame.empty or len(frame.columns)==0: raise HTTPException(status_code=400,detail="CSV contains no usable rows or columns.")
    # Store metadata only; raw files are not retained in this first ingestion increment.
    with SessionLocal() as db:
        item=DatasetRecord(title=title,investigation_id=investigation_id,filename=name,file_type="CSV",
                           rows_count=len(frame),columns_json=json.dumps(list(frame.columns)),
                           description="Metadata import; raw file is not persisted.",provenance=provenance)
        db.add(item);db.commit();db.refresh(item)
        return {"id":item.id,"title":title,"filename":name,"rows":len(frame),
                "columns":list(frame.columns),"preview":frame.head(8).replace({np.nan:None}).to_dict(orient="records"),
                "note":"Only metadata and preview were processed; raw data storage and scientific schema validation are future work."}

@app.get("/api/datasets")
def datasets():
    with SessionLocal() as db:
        rows=db.scalars(select(DatasetRecord).order_by(DatasetRecord.id.desc())).all()
        return [{"id":r.id,"title":r.title,"investigation_id":r.investigation_id,"filename":r.filename,
                 "file_type":r.file_type,"rows":r.rows_count,"columns":json.loads(r.columns_json),
                 "provenance":r.provenance,"created_at":r.created_at} for r in rows]

@app.post("/api/cv/analyze")
async def analyze_image(file: UploadFile=File(...), threshold:int=90):
    if file.content_type not in {"image/png","image/jpeg","image/webp","image/tiff"}: raise HTTPException(status_code=415,detail="Upload PNG, JPEG, WEBP or TIFF.")
    raw=await file.read()
    if len(raw)>15*1024*1024: raise HTTPException(status_code=413,detail="Image exceeds 15 MB.")
    image=cv2.imdecode(np.frombuffer(raw,np.uint8),cv2.IMREAD_COLOR)
    if image is None: raise HTTPException(status_code=400,detail="Could not decode image.")
    hsv=cv2.cvtColor(image,cv2.COLOR_BGR2HSV)
    warm=cv2.inRange(hsv,np.array([0,65,threshold]),np.array([45,255,255]))
    blue=cv2.inRange(hsv,np.array([80,35,threshold]),np.array([135,255,255]))
    mask=cv2.morphologyEx(cv2.bitwise_or(warm,blue),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    contours=[c for c in contours if cv2.contourArea(c)>=10]
    if not contours: return {"image_width":int(image.shape[1]),"image_height":int(image.shape[0]),"candidate_regions":0,"largest_region_area_px":0,"largest_region_perimeter_px":0,"circularity":None,"note":"No candidate region detected. Adjust threshold or image exposure."}
    c=max(contours,key=cv2.contourArea);area=float(cv2.contourArea(c));per=float(cv2.arcLength(c,True))
    return {"image_width":int(image.shape[1]),"image_height":int(image.shape[0]),"candidate_regions":len(contours),
            "largest_region_area_px":round(area,2),"largest_region_perimeter_px":round(per,2),
            "circularity":round(float(4*np.pi*area/(per*per)),4) if per else None,
            "note":"Pixel-space segmentation metric only; not a calibrated physical flame measurement."}

@app.post("/api/cv/video/analyze")
async def analyze_video(file: UploadFile=File(...), frame_stride:int=Form(5)):
    if file.content_type not in {"video/mp4","video/quicktime","video/x-msvideo","video/webm"}:
        raise HTTPException(status_code=415,detail="Supported video types: MP4, MOV, AVI, WEBM.")
    raw=await file.read()
    if len(raw)>100*1024*1024: raise HTTPException(status_code=413,detail="Video exceeds 100 MB.")
    suffix=pathlib.Path(file.filename or "clip.mp4").suffix or ".mp4"
    temp_path=None
    try:
        with tempfile.NamedTemporaryFile(delete=False,suffix=suffix) as tmp:
            tmp.write(raw);temp_path=tmp.name
        cap=cv2.VideoCapture(temp_path)
        if not cap.isOpened(): raise HTTPException(status_code=400,detail="Could not open video.")
        fps=cap.get(cv2.CAP_PROP_FPS) or 0
        total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        stride=max(1,min(frame_stride,120))
        rows=[];idx=0
        while len(rows)<300:
            ok,frame=cap.read()
            if not ok: break
            if idx%stride==0:
                hsv=cv2.cvtColor(frame,cv2.COLOR_BGR2HSV)
                mask=cv2.bitwise_or(cv2.inRange(hsv,np.array([0,65,90]),np.array([45,255,255])),
                                    cv2.inRange(hsv,np.array([80,35,90]),np.array([135,255,255])))
                contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
                contours=[c for c in contours if cv2.contourArea(c)>=10]
                area=float(max((cv2.contourArea(c) for c in contours),default=0))
                rows.append({"frame":idx,"time_s":round(idx/fps,3) if fps>0 else None,"candidate_area_px":round(area,2)})
            idx+=1
        cap.release()
        return {"fps":fps,"total_frames":total,"sampled_frames":len(rows),"frame_stride":stride,"series":rows,
                "note":"Sampled image-space candidate area using heuristic color segmentation. Camera motion, lighting and exposure affect results; not a validated flame-spread measurement."}
    finally:
        if temp_path and os.path.exists(temp_path): os.unlink(temp_path)
