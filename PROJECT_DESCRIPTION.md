# **AuraDesign RO - Project Description & Architecture**

## **Project Overview**

**Name:** AuraDesign RO (RoomRevive AI)  
**Purpose:** An AI-powered interior design application that enables users to upload room photos, analyze furniture, and generate design renders with **real products from Romanian e-commerce platforms** (not fictional furniture).

**Core Innovation:** "Real Product Staging" - Unlike generic AI design tools that generate imaginary furniture, AuraDesign integrates actual products from Romanian retailers, allowing users to:
1. See how real products look in their space
2. Directly purchase items they like
3. Interactively swap furniture pieces and re-render only that section

---

## **Tech Stack**

### **Backend**
- **Framework:** FastAPI 0.111.0 + Uvicorn (async Python web server)
- **API Orchestration:** LangGraph 1.0 (agentic workflow graph)
- **AI/LLM:** 
  - OpenAI GPT-4o (vision analysis)
  - OpenAI DALL-E 3 (image generation)
  - LangChain/LangSmith (LLM integration)
- **Image Processing:** Pillow 10.3.0
- **Environment:** python-dotenv 1.2.2
- **Database/Storage:** In-memory job store (GraphState) — currently not persisted
- **Testing:** pytest 9.0.3, pytest-asyncio 1.3.0

### **Frontend**
- **Framework:** Next.js 14.2.3 (React 18 + TypeScript)
- **Styling:** Tailwind CSS 3.x + PostCSS
- **State Management:** React Hooks (useState)
- **HTTP Client:** Fetch API (in `lib/api.ts`)
- **Build Tool:** Next.js built-in Webpack/SWC

### **DevOps**
- **Containerization:** Docker + docker-compose.yml (for future deployment)
- **Python Env:** Python 3.14 (system-wide)

---

## **Project Structure**

```
TopiciIs2/
├── backend/
│   ├── .env                          # API keys (OPENAI_API_KEY, ALLOWED_ORIGINS)
│   ├── .env.example                  # Template
│   ├── requirements.txt               # Python dependencies
│   ├── setup_venv.ps1                # PowerShell venv setup script
│   ├── Dockerfile
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI app factory, CORS setup
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   ├── vision_analyzer.py    # Agent 1: Analyzes room image
│   │   │   └── interior_designer.py  # Agent 2: Generates design render
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── routes.py             # POST /api/upload, /api/generate-design, GET /api/job/{id}
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── schemas.py            # Pydantic models: GraphState, RoomAnalysis, DesignProposal
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── graph.py              # LangGraph orchestration (Agent 1 → Agent 2)
│   │   │   └── storage.py            # In-memory job store
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── image.py              # Image validation & base64 encoding
│
├── frontend/
│   ├── package.json
│   ├── next.config.mjs
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Home page (renders DesignStudio)
│   │   │   ├── layout.tsx            # Root layout
│   │   │   └── globals.css           # Tailwind imports
│   │   ├── components/
│   │   │   ├── DesignStudio.tsx      # Main 4-step UI orchestrator
│   │   │   └── ui/
│   │   │       ├── ImageDropzone.tsx # Step 1: Image upload
│   │   │       ├── FurnitureChecklist.tsx # Step 2: Select furniture to keep
│   │   │       ├── StyleSelector.tsx # Step 2: Choose design style
│   │   │       ├── ResultCard.tsx    # Step 4: Display final render
│   │   │       └── Spinner.tsx       # Loading indicator
│   │   ├── hooks/
│   │   │   └── useDesignFlow.ts      # Custom hook: manages 4-step flow state
│   │   ├── lib/
│   │   │   └── api.ts                # HTTP calls to backend
│   │   └── types/
│   │       └── index.ts              # TypeScript interfaces (DesignStyle, AnalysisResponse, etc)
│
├── docker-compose.yml                # Compose definition for backend + frontend
└── PROJECT_DESCRIPTION.md            # This file
```

---

## **How It Works - Architecture Flow**

### **Step 1: User Upload → Vision Analyzer (Agent 1)**

```
Frontend (DesignStudio.tsx)
    ↓ [user selects image]
POST /api/upload (multipart image)
    ↓
Backend (routes.py)
    ├── Validate image (JPEG/PNG/WebP, <20MB)
    ├── Convert to base64
    ├── Create GraphState object
    ├── Run vision_analyzer_node()
    │   ├── Initialize ChatOpenAI("gpt-4o")
    │   ├── Send image + system prompt
    │   ├── GPT-4o returns JSON:
    │   │   {
    │   │     "room_type": "living room",
    │   │     "detected_furniture": [
    │   │       { "name": "sofa", "keep": true, "condition": "good", "estimated_position": "center" },
    │   │       { "name": "TV stand", "keep": true, "condition": "fair", ... },
    │   │       { "name": "curtains", "keep": false, "condition": "poor", ... }
    │   │     ],
    │   │     "spatial_notes": "...",
    │   │     "lighting": "natural + artificial",
    │   │     "raw_description": "..."
    │   │   }
    │   └── Parse JSON → RoomAnalysis model
    └── Persist state to job_store
    ↓
Backend returns AnalysisResponse
    └── { job_id: UUID, room_analysis: {...}, status: "analyzing" }
    ↓
Frontend shows Step 2: FurnitureChecklist + StyleSelector
```

### **Step 2: User Selects Furniture & Style**

- User can toggle each detected furniture item (✓ "keep" / ✗ "replace")
- User selects design style: Modern, Minimalist, Luxury, Scandinavian, Gaming Room
- User adds notes (optional)
- Frontend stores selections locally

### **Step 3: Generate Design → Interior Designer (Agent 2)**

```
Frontend
    ↓ [user clicks "Generate Design"]
POST /api/generate-design (with job_id, furniture_to_keep[], style, notes)
    ↓
Backend (routes.py)
    ├── Retrieve state from job_store using job_id
    ├── Run interior_designer_node()
    │   ├── Build a detailed prompt using:
    │   │   - RoomAnalysis (from Agent 1)
    │   │   - User's kept furniture
    │   │   - Design style guidance
    │   │   - User notes
    │   ├── Initialize ChatOpenAI("gpt-4o")
    │   ├── Ask: "Write a DALL-E 3 prompt for this room"
    │   ├── GPT-4o returns:
    │   │   {
    │   │     "image_prompt": "A modern living room with...",
    │   │     "design_rationale": "This design emphasizes..."
    │   │   }
    │   ├── Initialize OpenAI client
    │   ├── Call DALL-E 3: images.generate(prompt, size="1024x1024", quality="hd")
    │   ├── DALL-E returns image URL
    │   └── Store in GraphState as design_render_url
    └── Persist final state to job_store
    ↓
Backend returns DesignResponse
    └── { job_id: UUID, design_render_url: "https://...", design_rationale: "...", status: "completed" }
    ↓
Frontend Step 4: ResultCard displays image + rationale + "Purchase" button
```

### **LangGraph Orchestration (graph.py)**

The workflow is managed as a directed acyclic graph (DAG):

```
[START] → vision_analyzer_wrapper → [conditional] → interior_designer_wrapper → [END]
                                          ↓ (if failed)
                                        [END]
```

- If Agent 1 fails, the graph short-circuits and skips Agent 2
- Both agents return dict updates (LangGraph 1.0 API) which are merged into GraphState

---

## **Current Implementation Status**

### **✅ Completed**

1. **Backend API Skeleton**
   - FastAPI server with CORS
   - `/api/upload` → validates image, runs Agent 1 synchronously
   - `/api/generate-design` → runs Agent 2 synchronously
   - `/api/job/{job_id}` → polls job status
   - `/health` endpoint

2. **Agent 1 — Vision Analyzer**
   - GPT-4o vision model integration
   - Room analysis: detects furniture, room type, lighting, spatial notes
   - Returns structured JSON (RoomAnalysis model)

3. **Agent 2 — Interior Designer**
   - Takes RoomAnalysis + user preferences
   - Generates DALL-E 3 prompt
   - Calls DALL-E 3 to produce image
   - Returns render URL + design rationale

4. **Frontend UI (4-Step Flow)**
   - Step 1: Image upload (ImageDropzone)
   - Step 2: Furniture checklist + style selector
   - Step 3: Generate button (loading spinner)
   - Step 4: Display result card with image + purchase button

5. **Data Models**
   - GraphState (Pydantic) with job_id, status, image, analysis, render, etc.
   - DesignStyle enum (Modern, Minimalist, Luxury, Scandinavian, Gaming Room)
   - JobStatus enum (pending, analyzing, designing, completed, failed)

---

## **⏳ NOT YET Implemented (To-Do)**

### **Priority 1: Product Sourcing & Database**

**Market Agent** (not yet built)
- **What's missing:** Integration with Romanian e-commerce to fetch real product data
- **Needed:**
  - API connection to 2Performant affiliate feed (or eMAG, Mobidea, SomProduct)
  - Product database schema: `Product(id, name, price, image_url, product_link, category, dimensions)`
  - Supabase or PostgreSQL setup to store products
  - CLIP embedding for visual similarity matching
  - Periodic data refresh (cache product catalog)

### **Priority 2: Smart Replace / Interactive Inpainting**

**Inpainting Agent** (not yet built)
- **What's missing:** The core "Real Product Staging" differentiator
- **Needed:**
  - Segment Anything Model 2 (SAM 2) integration to mask furniture zones
  - Stable Diffusion Inpainting model
  - IP-Adapter to use real product images as visual references
  - ControlNet (Depth/Canny) for perspective matching
  - Endpoint: `POST /api/smart-replace` → takes (room_image, old_furniture_id, new_furniture_id) → returns inpainted image

### **Priority 3: Job Persistence & Async Processing**

- Replace in-memory job store with actual database
- Move Agent 2 (DALL-E generation) to background task (currently blocks response)
- Implement WebSocket for real-time status updates

### **Priority 4: Affiliate Links & E-Commerce Integration**

- Embed affiliate links in results
- Click tracking → revenue via 2Performant commissions
- Shopping cart integration

### **Priority 5: Landing Page & Marketing**

- SEO-optimized landing page
- Before/After carousel
- Video demo of Smart Replace feature
- CTA: "Try Free" → redirects to app

---

## **API Endpoints (Current)**

### **1. Health Check**
```
GET /health
Response: { "status": "ok" }
```

### **2. Upload Room Photo**
```
POST /api/upload
Content-Type: multipart/form-data
Body: { file: <image> }

Response:
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "room_analysis": {
    "room_type": "living room",
    "detected_furniture": [...],
    "spatial_notes": "...",
    "lighting": "natural",
    "raw_description": "..."
  },
  "status": "analyzing"
}
```

### **3. Generate Design**
```
POST /api/generate-design?job_id=<UUID>
Content-Type: application/json
Body:
{
  "desired_style": "Modern",
  "furniture_to_keep": ["sofa", "TV stand"],
  "user_notes": "Bright and airy"
}

Response:
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "design_render_url": "https://oaidalleapiprodscus.blob.core.windows.net/...",
  "design_rationale": "This modern design emphasizes...",
  "status": "completed"
}
```

### **4. Poll Job Status**
```
GET /api/job/<job_id>

Response:
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "image_base64": "...",
  "room_analysis": {...},
  "design_render_url": "...",
  "error": null
}
```

---

## **Environment Variables (.env)**

```
OPENAI_API_KEY=sk-proj-xxxxxx
ALLOWED_ORIGINS=http://localhost:3000
LOG_LEVEL=INFO

# Future (to be added):
DATABASE_URL=postgresql://user:pass@localhost/auradesign
SUPABASE_KEY=xxxxx
SUPABASE_URL=https://xxxxx.supabase.co
FIRECRAWL_API_KEY=xxxxx
GROQ_API_KEY=xxxxx
```

---

## **Current Run Instructions**

### **Start Backend**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### **Start Frontend**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

### **Access Points**
- Frontend: http://localhost:3000
- Backend API: http://127.0.0.1:8000
- Swagger Docs: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

---

## **Next Immediate Steps (Prioritized)**

1. **Build Market Agent** (Week 3-4)
   - Create `agents/market_agent.py`
   - Fetch product feeds from 2Performant
   - Store in Supabase
   - Implement CLIP-based visual matching

2. **Extend Vision Analyzer** (Week 5)
   - Add SAM 2 for precise furniture masking
   - Export masks as JSON

3. **Implement Inpainting Agent** (Week 6-7)
   - Set up Stable Diffusion Inpainting
   - Integrate IP-Adapter + ControlNet
   - Create `/api/smart-replace` endpoint

4. **Enhance Frontend** (Week 8-9)
   - Add interactive furniture replacement UI
   - Display product catalog sidebar
   - Show affiliate links in results

5. **QA & Optimization** (Week 10-14)
   - Performance testing
   - Error handling
   - Launch preparation

---

## **Key Design Decisions**

1. **Synchronous Processing** (for MVP)
   - Both agents run synchronously in the request/response cycle
   - Production should move to background jobs + WebSocket updates

2. **Pydantic for State Management**
   - All AI state flows through strongly-typed `GraphState` model
   - Makes LangGraph integration clean and type-safe

3. **Stateless API**
   - Job IDs enable multi-step workflows without sessions
   - Each request is independent; state persists via job_store

4. **Separation of Concerns**
   - Agents handle AI logic
   - Routes handle HTTP / validation
   - Services handle orchestration + storage
   - Utils handle helpers

---

## **Known Limitations & Tech Debt**

1. **No Real Database** — currently all jobs stored in-memory, lost on server restart
2. **No Product Data** — Market Agent not yet implemented
3. **No Inpainting** — Smart Replace feature is the key differentiator but not built yet
4. **Blocking Requests** — DALL-E calls block the HTTP response
5. **No Authentication** — anyone can use the API (needed for production)
6. **Limited Error Handling** — generic 500s instead of helpful error messages
7. **No Caching** — repeated requests re-process images unnecessarily

---

## **Git/Version Control**

```
.git/          # Already initialized
.gitignore     # Excludes .env, node_modules, __pycache__, .venv
```

Everything is tracked. `.env` is in `.gitignore` (safe).

---

## **Deployment Options**

- **docker-compose.yml** ready for Docker
- Can deploy backend to: AWS Lambda, Railway, Render, Vercel
- Frontend: Vercel, Netlify, AWS Amplify
- Database: Supabase (PostgreSQL), Firebase, AWS RDS
