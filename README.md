# AuraDesign RO

> Redesign your room with real Romanian furniture — powered by a multi-agent AI pipeline.

Upload a photo of your room. Select a style and what to keep. The system finds real products from Romanian stores, shows them to you for review, then renders each one into your photo using generative AI — one product at a time.

---

## How it works

```
Photo upload
    │
    ▼
┌─────────────────────────────────────┐
│  Agent 1 — Vision Analyzer          │
│  GPT-4o Vision                      │
│  Detects furniture, layout, lighting│
└──────────────────┬──────────────────┘
                   │ RoomAnalysis
                   ▼
┌─────────────────────────────────────┐
│  Agent 2 — Design Planner           │
│  GPT-4o                             │
│  Creates a redesign plan with       │
│  specific item slots & placements   │
└──────────────────┬──────────────────┘
                   │ DesignPlan (suggestions[])
                   ▼
┌─────────────────────────────────────┐
│  Agent 3 — Market Agent             │
│  OpenAI Responses API               │
│  web_search_preview tool            │
│  Finds real products (eMAG, JYSK,   │
│  Vivre) + downloads product images  │
└──────────────────┬──────────────────┘
                   │ sourced_products[]   ← USER REVIEWS & CONFIRMS HERE
                   ▼
┌─────────────────────────────────────┐
│  Agent 4 — Iterative Renderer       │
│  gpt-image-1  (images.edit API)     │
│  Applies each product to the room   │
│  photo one at a time, preserving    │
│  all previously placed items        │
└──────────────────┬──────────────────┘
                   │ DesignProposal (step-by-step images)
                   ▼
             Final result + product links
```

**Orchestrator:** LangGraph `StateGraph` passes a single `GraphState` object through all four agents.

---

## Project structure

```
TopiciIs2/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── vision_analyzer.py      # Agent 1 — GPT-4o Vision
│   │   │   ├── design_planner.py       # Agent 2 — GPT-4o
│   │   │   ├── market_agent.py         # Agent 3 — web search + image scraping
│   │   │   └── iterative_renderer.py   # Agent 4 — gpt-image-1
│   │   ├── api/
│   │   │   └── routes.py               # FastAPI endpoints
│   │   ├── models/
│   │   │   └── schemas.py              # Pydantic models (GraphState, DesignPlan, …)
│   │   ├── services/
│   │   │   ├── graph.py                # LangGraph pipeline
│   │   │   └── storage.py             # In-memory job store
│   │   ├── data/
│   │   │   └── products.json           # Local product catalog (fallback)
│   │   └── main.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                # Landing page (/)
│   │   │   └── studio/page.tsx         # Design app (/studio)
│   │   ├── components/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── DesignStudio.tsx        # Main app shell
│   │   │   └── ui/
│   │   │       ├── ImageDropzone.tsx
│   │   │       ├── FurnitureChecklist.tsx
│   │   │       ├── StyleSelector.tsx   # 11 design styles
│   │   │       ├── ProductPreview.tsx  # Review products before render
│   │   │       ├── ResultCard.tsx      # Step-by-step result viewer
│   │   │       ├── DesignCart.tsx
│   │   │       └── Spinner.tsx
│   │   ├── hooks/
│   │   │   └── useDesignFlow.ts        # All app state & API calls
│   │   ├── lib/
│   │   │   └── api.ts                  # Typed fetch wrappers
│   │   └── types/
│   │       └── index.ts
│   └── package.json
│
└── docker-compose.yml
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Upload room photo → run Vision Analyzer |
| `POST` | `/api/source-products?job_id=` | Run Planner + Market Agent → return product list |
| `POST` | `/api/find-more-products?job_id=` | Re-run Market Agent, append new alternatives |
| `POST` | `/api/render-design?job_id=` | Run Iterative Renderer on confirmed products |
| `POST` | `/api/add-custom-product?job_id=` | Add user-provided product URL (auto-fetches image) |
| `DELETE` | `/api/remove-sourced-product?job_id=` | Remove a product from the list |
| `POST` | `/api/smart-replace?job_id=` | Swap one product and re-render |
| `GET` | `/api/job/{job_id}` | Poll job status / fetch result |
| `GET` | `/api/products` | Search the local product catalog |

Interactive docs: `http://localhost:8000/docs`

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | FastAPI, Uvicorn, Pydantic v2 |
| Orchestration | LangGraph `StateGraph` |
| AI — Vision | GPT-4o Vision (`ChatOpenAI`) |
| AI — Planning | GPT-4o (`ChatOpenAI`) |
| AI — Market search | OpenAI Responses API + `web_search_preview` |
| AI — Image editing | `gpt-image-1` via `client.images.edit` |
| Image processing | Pillow |
| HTTP scraping | httpx |
| Containerization | Docker, docker-compose |

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- OpenAI API key with access to `gpt-image-1`

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env
echo "OPENAI_API_KEY=sk-..." > .env

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev
```

Open `http://localhost:3000`

### Docker (both services)

```bash
# Add your key to backend/.env first
docker-compose up --build
```

---

## User flow

```
/ (landing)  →  /studio

1. Upload room photo
2. AI analyzes the room — see detected furniture
3. Choose what to keep, pick a design style (11 options), set budget
4. AI searches Romanian stores for real matching products
5. Review the product list — remove, add your own URL, or find more alternatives
6. Confirm → AI renders each product into your photo, one at a time
7. Step through the before/after progression, buy directly from store links
```

---

## Design styles supported

Modern · Minimalist · Luxury · Scandinavian · Japandi · Industrial · Bohemian · Art Deco · Coastal · Traditional · Gaming Room

---

## Notes

- **Job persistence:** the job store is in-memory. Restarting the backend loses all active jobs — do not restart between the upload and render steps.
- **Rendering time:** approximately 30–60 seconds per product (gpt-image-1 rate limits apply).
- **Image quality:** each iterative edit explicitly instructs the model to preserve all previously placed items at full sharpness.
