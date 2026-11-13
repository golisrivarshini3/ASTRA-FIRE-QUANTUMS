# ASTRA-FIRE 2.3 — Space Combustion Intelligence

ASTRA-FIRE is an independent NASA Space Apps Challenge prototype for exploring combustion research, comparing investigation metadata, reviewing experimental data and asking evidence-grounded research questions.

## Stack
- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, Recharts
- Backend: FastAPI, Pydantic, SQLAlchemy
- Science and analysis: NumPy, Pandas, OpenCV, scikit-learn
- Documents: PyMuPDF
- Storage: SQLite by default; PostgreSQL optional
- Local generation: Ollama optional

## Important compatibility note
Use **Python 3.11** (recommended) for the backend. This avoids the Python 3.9 / modern dependency compatibility problems encountered in the previous release.

## Run locally

### 1. Backend
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=qwen3.5:9b
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check:
- Health: http://127.0.0.1:8000/api/health
- API docs: http://127.0.0.1:8000/docs
- Overview: http://127.0.0.1:8000/api/overview

### 2. Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. Workbench: http://localhost:3000/lab.

If the frontend cannot reach the API, create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```
Restart `npm run dev` after changing environment variables.

### 3. Optional Ollama
```bash
ollama serve
ollama pull qwen3.5:9b
```
Keep Ollama running in another terminal. In the Research Assistant, enable **Use local Ollama model**.

### 4. Optional PostgreSQL
At project root:
```bash
docker compose up -d db
export DATABASE_URL='postgresql+psycopg://astra:astra_dev_password@localhost:5432/astrafire'
```
SQLite is the default and requires no database server.

## What's improved in 2.3 and retained from 2.2
- Python 3.9 annotation crash fixed with postponed annotation evaluation.
- API network failures now show actionable frontend error messages.
- CORS supports localhost and 127.0.0.1 frontend origins by default.
- Assistant retrieves ranked passages from uploaded documents instead of comparing only entire documents.
- Retrieval adds domain aliases for common question phrasing and prioritizes investigation names/objectives.
- Ollama prompts require source IDs, low-temperature output, explicit evidence gaps and a distinction between observations and applications.
- Ollama connection/model failures return a clear fallback rather than silently hiding the failure.
- Investigation ranking provides a transparent prototype score breakdown.
- Workbench has responsive file pickers, tabular CSV preview, video trend chart and editable physics inputs.
- Keyboard focus, reduced-motion and mobile layout refinements.

## Main API routes
- `GET /api/health`
- `GET /api/overview`
- `GET /api/investigations`
- `POST /api/rank`
- `POST /api/atmosphere`
- `POST /api/physics/dimensionless`
- `POST /api/assistant`
- `POST /api/documents/upload`
- `GET /api/documents`
- `POST /api/datasets/import`
- `GET /api/datasets`
- `POST /api/cv/analyze`
- `POST /api/cv/video/analyze`

## Scientific and data limitations
- The 15-row starter catalog is a curated prototype, not a complete NASA PSI export. Verify each investigation's title, hardware, conditions and measurement channels against its original NASA record.
- Ranking is an explainable metadata heuristic, not an official NASA ranking or validated safety score.
- Document retrieval uses TF-IDF lexical similarity, not a semantic embedding model. It retrieves text passages but does not establish scientific truth.
- Ollama generation is constrained by retrieved context but still requires human review; citations should be checked against the source documents.
- CSV ingestion stores metadata and a preview only, not the original measurement series.
- Video analysis uses broad HSV color segmentation and reports pixel-space candidate area. It is not a trained flame classifier or calibrated physical flame-spread measurement.
- Dimensionless calculations require correct fluid properties, units and characteristic scales. They are not ignition or spacecraft fire-risk predictions.
- Microgravity is not partial gravity. E-FIELD Flames does not constitute an actual partial-gravity test.
- This is not a certified fire-safety system and is not endorsed by NASA.


## 2.3 mission-first UI/UX update
- Reframed the home dashboard around the Flames in Free Fall challenge question: fire safety in crewed spacecraft and surface habitats.
- Added interactive mission scenarios: crewed spacecraft, lunar habitat, pressurized rover, and material qualification.
- Scenario selection preconfigures research priorities and opens explainable investigation ranking.
- Added a challenge workflow: discover NASA investigations, compare/prioritize evidence, interpret conditions and research gaps.
- Reworked safety-pillar language into concrete research questions.
- Added mobile horizontal navigation, responsive scenario cards, accessible selected states, and API retry action.
- Preserves scientific caveats: relevance scores are not risk probabilities; microgravity is not lunar partial gravity.
