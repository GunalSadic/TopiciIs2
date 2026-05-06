# **AuraDesign RO - Technical Deep Dive: How Technologies Interact**

## **1. Core Technology Interactions Map**

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER (Next.js)                    │
│                                                                    │
│  React Component (DesignStudio.tsx)                              │
│      ↓ (state management via hooks)                              │
│  useDesignFlow() [custom React hook]                             │
│      ↓ (calls)                                                    │
│  lib/api.ts [Fetch API wrapper]                                  │
│      ↓ (HTTP)                                                    │
└─────────────────────────────────────────────────────────────────┘
                          ↓ (POST requests)
                   CORS-enabled endpoint
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Python)                        │
│                                                                    │
│  1. routes.py [@router.post("/api/upload")]                     │
│     ├─ Receives: multipart/form-data (image file)               │
│     ├─ Calls: image.py::validate_and_encode_image()             │
│     │   └─ Returns: base64 string (data:image/jpeg;base64,...)  │
│     ├─ Creates: GraphState(image_base64=b64)                    │
│     ├─ Stores: job_store.save(state)                            │
│     ├─ Calls: vision_analyzer_node(state)                       │
│     │   [runs Agent 1 synchronously]                            │
│     └─ Returns: AnalysisResponse(job_id, room_analysis, status) │
│                          ↓                                       │
│  2. agents/vision_analyzer.py [Agent 1 — LangChain Integration] │
│     ├─ Input: GraphState with image_base64                      │
│     ├─ Creates: ChatOpenAI(model="gpt-4o")                      │
│     │   ├─ Uses: LangChain's OpenAI wrapper                     │
│     │   ├─ Configures: temperature=0, max_tokens=1500           │
│     │   └─ Tracks: LangSmith observability                      │
│     ├─ Builds: HumanMessage with image content + system prompt  │
│     │   └─ Image format: URL (data:image/jpeg;base64,...)       │
│     ├─ Calls: llm.invoke([message])                             │
│     │   └─ Returns: AIMessage with raw text                     │
│     ├─ Parses: JSON response → RoomAnalysis model               │
│     ├─ Updates: state.room_analysis = RoomAnalysis(...)         │
│     ├─ Sets: state.status = JobStatus.ANALYZING → COMPLETED     │
│     └─ Returns: updated GraphState                              │
│                          ↓                                       │
│  3. routes.py [@router.post("/api/generate-design")]            │
│     ├─ Retrieves: state from job_store(job_id)                  │
│     ├─ Receives: DesignRequest(desired_style, furniture_to_keep)│
│     ├─ Calls: interior_designer_node(state)                     │
│     │   [runs Agent 2 synchronously]                            │
│     └─ Returns: DesignResponse(design_render_url, rationale)    │
│                          ↓                                       │
│  4. agents/interior_designer.py [Agent 2 — Multi-step LLM Chain]│
│     ├─ Input: GraphState with room_analysis + user preferences  │
│     ├─ Step 1: Build detailed prompt from room_analysis         │
│     │   └─ Uses: STYLE_GUIDANCE dict (per design style)         │
│     ├─ Step 2: Creates: ChatOpenAI(model="gpt-4o")              │
│     │   └─ Sends: prompt asking for JSON (image_prompt + rationale)
│     ├─ Step 3: Receives: AIMessage with JSON                    │
│     ├─ Step 4: Parses: JSON → DesignProposal model              │
│     ├─ Step 5: Creates: OpenAI native client (not LangChain)    │
│     │   └─ Uses: openai.OpenAI() for images.generate()          │
│     ├─ Step 6: Calls: client.images.generate(                  │
│     │   prompt=image_prompt,                                    │
│     │   model="dall-e-3",                                        │
│     │   size="1024x1024",                                        │
│     │   quality="hd"                                            │
│     │ )                                                          │
│     │   └─ Returns: Image object with url property              │
│     ├─ Step 7: Stores: state.design_render_url = url            │
│     ├─ Sets: state.status = JobStatus.DESIGNING → COMPLETED     │
│     └─ Returns: updated GraphState                              │
│                          ↓                                       │
│  5. services/graph.py [LangGraph Orchestration]                 │
│     ├─ Wraps both agents in LangGraph nodes                     │
│     ├─ Topology:                                                │
│     │  [START] → vision_analyzer → [conditional] →              │
│     │            interior_designer → [END]                      │
│     ├─ Conditional edge: if state.status == FAILED → skip       │
│     ├─ Compiles graph with: StateGraph(GraphState)              │
│     │   └─ GraphState is Pydantic model used as state schema    │
│     └─ Returns: compiled runnable graph                         │
│                          ↓                                       │
│  6. services/storage.py [In-Memory Job Store]                   │
│     ├─ Persists: GraphState objects by job_id (UUID)            │
│     ├─ get(job_id) → retrieves state from memory dict           │
│     ├─ save(state) → stores state                               │
│     └─ Note: This is ephemeral; replaced by DB in production    │
│                          ↓                                       │
│  7. models/schemas.py [Pydantic Data Models]                    │
│     ├─ GraphState: Master state object                          │
│     │   ├─ job_id: UUID (auto-generated)                        │
│     │   ├─ image_base64: str                                    │
│     │   ├─ room_analysis: RoomAnalysis | None                   │
│     │   ├─ desired_style: DesignStyle                           │
│     │   ├─ design_render_url: str | None                        │
│     │   ├─ status: JobStatus                                    │
│     │   └─ error: str | None                                    │
│     │                                                            │
│     ├─ RoomAnalysis: Structured AI output from Agent 1          │
│     │   ├─ room_type: str                                       │
│     │   ├─ detected_furniture: list[DetectedFurniture]          │
│     │   ├─ spatial_notes: str                                   │
│     │   ├─ lighting: str                                        │
│     │   └─ raw_description: str                                 │
│     │                                                            │
│     ├─ DetectedFurniture: Individual item from room             │
│     │   ├─ name: str                                            │
│     │   ├─ keep: bool (user toggleable)                         │
│     │   ├─ condition: Literal["good"|"fair"|"poor"]             │
│     │   └─ estimated_position: str                              │
│     │                                                            │
│     ├─ DesignStyle: User choice enum                            │
│     │   ├─ Modern, Minimalist, Luxury, Scandinavian, Gaming...  │
│     │                                                            │
│     ├─ DesignProposal: AI output from Agent 2 (step 1)          │
│     │   ├─ image_prompt: str (for DALL-E)                       │
│     │   └─ design_rationale: str (for user)                     │
│     │                                                            │
│     ├─ JobStatus: Workflow state enum                           │
│     │   ├─ PENDING, ANALYZING, DESIGNING, COMPLETED, FAILED     │
│     │                                                            │
│     ├─ AnalysisResponse: HTTP response after Agent 1            │
│     ├─ DesignResponse: HTTP response after Agent 2              │
│     └─ DesignRequest: HTTP request body for Agent 2             │
└─────────────────────────────────────────────────────────────────┘
                          ↑ (JSON responses)
                   (HTTP 200 / 500)
                          ↑
┌─────────────────────────────────────────────────────────────────┐
│              Frontend Receives Response (Next.js)                │
│                                                                   │
│  Fetch Promise resolves                                         │
│      ↓                                                            │
│  JSON parsed by lib/api.ts                                       │
│      ↓                                                            │
│  useDesignFlow hook updates React state                         │
│      ↓                                                            │
│  Components re-render (ResultCard displays image)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## **2. How LangChain & LangGraph Work Together**

### **LangChain Layer (What it does)**
```
LangChain = Abstraction layer over LLM APIs

┌─ ChatOpenAI(model="gpt-4o")
│  ├─ Wraps: openai.OpenAI() client
│  ├─ Provides: .invoke(messages) → AIMessage
│  ├─ Adds: Token counting, retry logic, streaming support
│  └─ Integrates: LangSmith for observability (optional)
│
├─ HumanMessage / SystemMessage / AIMessage
│  ├─ Standardized message format (works across any LLM)
│  └─ Content can be: str OR list of content blocks
│      └─ Content blocks: { "type": "text"/"image_url", ... }
│
└─ LangSmith integration (automatic)
   ├─ Traces every LLM call
   ├─ Logs: prompts, responses, latency, tokens
   └─ Used for debugging & optimization
```

### **LangGraph Layer (What it does)**
```
LangGraph = State machine for multi-agent workflows

Components:
├─ StateGraph(GraphState)
│  ├─ Takes Pydantic model as schema
│  ├─ Enforces: all state updates must match GraphState fields
│  └─ Provides: compile() → executable graph
│
├─ Nodes (Agent 1, Agent 2)
│  ├─ Each node is a function: fn(state: GraphState) → dict
│  ├─ Receives: current state
│  ├─ Returns: dict of changed fields (not whole state)
│  └─ LangGraph merges returned dict back into state
│
├─ Edges
│  ├─ add_edge(from, to): Always execute to after from
│  ├─ add_conditional_edges(from, condition_fn, {True: to1, False: to2})
│  │  └─ Calls condition_fn(state) → destination node name
│  └─ Special: START (entry point), END (exit point)
│
└─ Compilation (build_graph().compile())
   ├─ Validates graph topology (no cycles unless explicit)
   ├─ Creates: runnable graph object
   └─ Ready for: .invoke() or .ainvoke() calls
```

### **In Our Project**

```python
# 1. Define state structure (Pydantic)
class GraphState(BaseModel):
    job_id: UUID
    image_base64: str
    room_analysis: RoomAnalysis | None = None
    design_render_url: str | None = None
    status: JobStatus = JobStatus.PENDING
    error: str | None = None

# 2. Create agents (use LangChain's ChatOpenAI)
def vision_analyzer_node(state: GraphState) -> GraphState:
    llm = ChatOpenAI(model="gpt-4o")  # ← LangChain wrapper
    message = HumanMessage(content=[...])
    response = llm.invoke([message])  # ← Call OpenAI via LangChain
    state.room_analysis = RoomAnalysis.model_validate_json(response.content)
    return state

# 3. Wire into LangGraph
graph = StateGraph(GraphState)  # ← Pass Pydantic model
graph.add_node("vision_analyzer", vision_analyzer_wrapper)
graph.add_edge(START, "vision_analyzer")
compiled = graph.compile()  # ← Create executable DAG
```

---

## **3. How FastAPI + Async Interacts with LangChain**

### **Request Flow (Synchronous in MVP)**

```
FastAPI (ASGI server)
    ↓
routes.py [@router.post("/api/upload")]
    ├─ Async function: async def upload_room(...)
    ├─ Receives: UploadFile (async file object)
    ├─ Awaits: image_b64 = await validate_and_encode_image(file)
    ├─ Calls: vision_analyzer_node(state)  ← SYNC call, not awaited
    │         (This blocks the async task, but only for LLM inference)
    ├─ Awaits: job_store.save(state)  ← Async storage operation
    └─ Returns: JSONResponse with AnalysisResponse.model_dump_json()

LangChain ChatOpenAI
    ├─ .invoke() is SYNC (uses requests under the hood)
    ├─ But FastAPI runs it inside an async context
    ├─ FastAPI's event loop: handles I/O concurrency for other requests
    └─ This request blocks FastAPI until LLM returns (OK for MVP, bad for production)
```

### **Why This Matters**

```
MVP: Synchronous (blocks request)
┌─────────────────────────┐
│ POST /api/upload        │
│ (waiting 10-15 seconds  │
│  for GPT-4o response)   │  ← Browser shows spinner
│                         │
│ Returns 200 OK          │
└─────────────────────────┘

Production: Asynchronous (recommended)
┌─────────────────────────┐     ┌─────────────────────────┐
│ POST /api/upload        │     │ Background Task Queue   │
│ (returns 202 Accepted   │─────│ (runs GPT-4o)           │
│  immediately with       │     │                         │
│  job_id)                │     │ After 10-15s:           │
└─────────────────────────┘     │ Notify client via       │
                                │ WebSocket               │
Browser polls                   └─────────────────────────┘
GET /api/job/{job_id}
```

---

## **4. How Pydantic Models Flow Through the System**

### **Data Transformation Pipeline**

```
RAW IMAGE FILE
    ↓ (validate_and_encode_image)
BASE64 STRING
    ↓ (create GraphState)
┌─────────────────────────┐
│ GraphState(             │ ← Pydantic model
│   job_id=UUID(...),     │   (has validation)
│   image_base64="data:...", │
│   status=PENDING        │
│ )                       │
└─────────────────────────┘
    ↓ (pass to vision_analyzer_node)
    ↓ (LangChain processes image)
    ↓ (GPT-4o returns JSON string)
    ↓ (parse JSON)
┌─────────────────────────────────┐
│ RoomAnalysis(                   │ ← Nested Pydantic model
│   room_type="living room",      │   (validated by Pydantic)
│   detected_furniture=[          │
│     DetectedFurniture(          │   ← Another nested model
│       name="sofa",              │
│       keep=True,                │
│       condition="good",         │
│       estimated_position="..."  │
│     ),                          │
│     ...                         │
│   ],                            │
│   spatial_notes="...",          │
│   lighting="natural",           │
│   raw_description="..."         │
│ )                               │
└─────────────────────────────────┘
    ↓ (update state)
┌──────────────────────────────────┐
│ GraphState(                      │ ← Updated state
│   job_id=UUID(...),              │
│   image_base64="data:...",       │
│   room_analysis=RoomAnalysis(...), │ ← Now populated
│   status=ANALYZING               │
│ )                                │
└──────────────────────────────────┘
    ↓ (pass to interior_designer_node)
    ↓ (LangChain processes room_analysis)
    ↓ (GPT-4o returns JSON)
┌─────────────────────────────────┐
│ DesignProposal(                 │ ← New Pydantic model
│   image_prompt="A modern...",   │
│   design_rationale="This design" │
│ )                               │
└─────────────────────────────────┘
    ↓ (pass image_prompt to DALL-E)
    ↓ (DALL-E returns image URL)
    ↓ (update state)
┌──────────────────────────────────┐
│ GraphState(                      │ ← Final state
│   job_id=UUID(...),              │
│   image_base64="data:...",       │
│   room_analysis=RoomAnalysis(...),│
│   design_render_url="https://...",│ ← Now populated
│   status=COMPLETED               │
│ )                                │
└──────────────────────────────────┘
    ↓ (convert to JSON for HTTP response)
    ↓ (Pydantic's model_dump_json())
┌────────────────────────────────────────────┐
│ HTTP 200 OK                                │
│ Content-Type: application/json             │
│ Body: {                                    │
│   "job_id": "550e8400...",                 │
│   "room_analysis": {...},                  │
│   "design_render_url": "https://...",      │
│   "status": "completed"                    │
│ }                                          │
└────────────────────────────────────────────┘
    ↓ (Fetch API receives & parses JSON)
    ↓ (React hook updates state)
    ↓ (Component re-renders)
BROWSER DISPLAYS RESULT IMAGE
```

### **Why Pydantic?**

```
Benefits:
├─ Type Safety: Catches JSON parse errors early
├─ Validation: Custom validators for fields
├─ Serialization: .model_dump_json() → JSON string
├─ Deserialization: .model_validate_json() → object
├─ Documentation: Schema automatically generated
└─ LangGraph Integration: StateGraph(GraphState) uses Pydantic schema

Example validation:
┌─────────────────────────────────────────┐
│ If server returns:                      │
│ {                                       │
│   "job_id": "invalid-uuid",  ← REJECTED │
│   "status": "unknown"        ← REJECTED │
│ }                                       │
│                                         │
│ Pydantic raises:                        │
│ ValidationError: 2 validation errors    │
│  - job_id: invalid UUID format          │
│  - status: must be in enum [pending...] │
└─────────────────────────────────────────┘
```

---

## **5. How OpenAI APIs are Called & Integrated**

### **Two Different OpenAI Integrations**

```
AGENT 1: Vision Analyzer
┌────────────────────────────────────────┐
│ ChatOpenAI (LangChain wrapper)         │
│                                        │
│ from langchain_openai import          │
│   ChatOpenAI                           │
│                                        │
│ llm = ChatOpenAI(                      │
│   model="gpt-4o",                      │
│   temperature=0,                       │
│   max_tokens=1500,                     │
│   api_key=os.getenv("OPENAI_API_KEY")  │
│ )                                      │
│                                        │
│ response = llm.invoke([message])       │
│   ↓                                    │
│   Internally:                          │
│   ├─ Uses: openai.OpenAI() client      │
│   ├─ Calls: client.chat.completions.  │
│   │         create(model=..., ...)     │
│   ├─ Wraps: response in AIMessage      │
│   └─ Returns: AIMessage object         │
│                                        │
│ Benefits:                              │
│ ├─ Automatic retry logic               │
│ ├─ LangSmith tracing                   │
│ ├─ Works with any LLM (swap model)     │
│ └─ Streaming support (.stream())       │
└────────────────────────────────────────┘

AGENT 2: Interior Designer (Step 1 — Prompt Generation)
┌────────────────────────────────────────┐
│ ChatOpenAI (same as Agent 1)           │
│ Used for generating DALL-E prompt      │
└────────────────────────────────────────┘

AGENT 2: Interior Designer (Step 2 — Image Generation)
┌────────────────────────────────────────┐
│ OpenAI Native Client (direct)          │
│                                        │
│ from openai import OpenAI              │
│                                        │
│ client = OpenAI(                       │
│   api_key=os.getenv("OPENAI_API_KEY")  │
│ )                                      │
│                                        │
│ response = client.images.generate(     │
│   model="dall-e-3",                    │
│   prompt=image_prompt,                 │
│   size="1024x1024",                    │
│   quality="hd",                        │
│   n=1                                  │
│ )                                      │
│                                        │
│ image_url = response.data[0].url        │
│                                        │
│ Why native client here?                │
│ ├─ LangChain doesn't wrap images.gen.  │
│ ├─ Direct API call is simpler          │
│ └─ DALL-E 3 is proprietary (no LLM)    │
└────────────────────────────────────────┘
```

### **Request/Response Flow**

```
AGENT 1 CALL SEQUENCE:
┌─────────────────────────────────────────────────────────────┐
│ 1. Python code:                                             │
│    llm.invoke([                                             │
│      HumanMessage(                                          │
│        content=[                                            │
│          {                                                  │
│            "type": "text",                                  │
│            "text": "Analyze this room..."                   │
│          },                                                 │
│          {                                                  │
│            "type": "image_url",                             │
│            "image_url": {                                   │
│              "url": "data:image/jpeg;base64,/9j/4AA..."     │
│            }                                                │
│          }                                                  │
│        ]                                                    │
│      )                                                      │
│    ])                                                       │
│                                                             │
│ 2. LangChain converts to OpenAI format:                     │
│    {                                                        │
│      "model": "gpt-4o",                                     │
│      "messages": [                                          │
│        {                                                    │
│          "role": "user",                                    │
│          "content": [                                       │
│            {                                                │
│              "type": "text",                                │
│              "text": "Analyze..."                           │
│            },                                               │
│            {                                                │
│              "type": "image_url",                           │
│              "image_url": {                                 │
│                "url": "data:image/jpeg;base64,..."          │
│              }                                              │
│            }                                                │
│          ]                                                  │
│        }                                                    │
│      ],                                                     │
│      "temperature": 0,                                      │
│      "max_tokens": 1500                                     │
│    }                                                        │
│                                                             │
│ 3. HTTP POST to OpenAI API:                                │
│    POST https://api.openai.com/v1/chat/completions         │
│    Authorization: Bearer sk-proj-xxxxxx                    │
│    [JSON body above]                                        │
│                                                             │
│ 4. OpenAI processes (10-15 seconds):                        │
│    ├─ Extracts image from base64                           │
│    ├─ Runs GPT-4o vision model                             │
│    ├─ Generates JSON response                              │
│    └─ Streams back token by token                          │
│                                                             │
│ 5. OpenAI returns:                                          │
│    {                                                        │
│      "id": "chatcmpl-...",                                  │
│      "object": "chat.completion",                          │
│      "model": "gpt-4o-...",                                │
│      "choices": [                                           │
│        {                                                    │
│          "message": {                                       │
│            "role": "assistant",                             │
│            "content": "{\n  \"room_type\": \"living room\",..." 
│          },                                                 │
│          "finish_reason": "stop"                            │
│        }                                                    │
│      ],                                                     │
│      "usage": {                                             │
│        "prompt_tokens": 1234,                               │
│        "completion_tokens": 567,                            │
│        "total_tokens": 1801                                 │
│      }                                                      │
│    }                                                        │
│                                                             │
│ 6. LangChain wraps in AIMessage:                            │
│    AIMessage(                                               │
│      content="{\"room_type\": \"living room\", ...}",       │
│      response_metadata={...}                                │
│    )                                                        │
│                                                             │
│ 7. Python code extracts content:                            │
│    raw_text = response.content                              │
│                                                             │
│ 8. Pydantic validates JSON:                                 │
│    room_analysis = RoomAnalysis.model_validate_json(raw_text) │
│                                                             │
│ 9. State updated:                                           │
│    state.room_analysis = room_analysis                      │
│    state.status = JobStatus.COMPLETED                       │
└─────────────────────────────────────────────────────────────┘
```

---

## **6. How Frontend & Backend Communicate**

### **The HTTP Contract**

```
Frontend (Next.js)
    ↓ [user picks image]
    ├─ React state updates
    ├─ DesignStudio component re-renders
    └─ useDesignFlow hook called

useDesignFlow hook (custom React hook)
    ├─ State: step, error, analysis, result, keepList
    ├─ Handlers: handleUpload, handleGenerate, etc.
    └─ Uses: lib/api.ts wrapper functions

lib/api.ts (HTTP wrapper)
    ├─ uploadRoom(file: File) → Promise<AnalysisResponse>
    │  │
    │  └─ HTTP:
    │     POST /api/upload
    │     Content-Type: multipart/form-data
    │     Body: { file: <binary image> }
    │
    │     Response:
    │     { job_id, room_analysis, status }
    │
    ├─ generateDesign(jobId, request) → Promise<DesignResponse>
    │  │
    │  └─ HTTP:
    │     POST /api/generate-design?job_id=<UUID>
    │     Content-Type: application/json
    │     Body: { desired_style, furniture_to_keep, user_notes }
    │
    │     Response:
    │     { job_id, design_render_url, design_rationale, status }
    │
    └─ checkStatus(jobId) → Promise<GraphState>
       │
       └─ HTTP:
          GET /api/job/<job_id>

          Response:
          { job_id, status, image_base64, room_analysis, ... }
```

### **CORS (Cross-Origin Resource Sharing)**

```
Frontend URL: http://localhost:3000
Backend URL: http://127.0.0.1:8000

These are DIFFERENT ORIGINS (different ports)

FastAPI CORS middleware (in main.py):
┌────────────────────────────────────────┐
│ app.add_middleware(                    │
│   CORSMiddleware,                      │
│   allow_origins=[                      │
│     "http://localhost:3000"  ← Allow   │
│   ],                                   │
│   allow_credentials=True,              │
│   allow_methods=["*"],                 │
│   allow_headers=["*"],                 │
│ )                                      │
│                                        │
│ This allows frontend to:               │
│ ├─ Make POST requests to /api/upload   │
│ ├─ Send Content-Type: application/json │
│ ├─ Include Authorization headers       │
│ └─ Receive responses                   │
│                                        │
│ Without this, browser would block with:│
│ "Cross-Origin Request Blocked"         │
└────────────────────────────────────────┘
```

---

## **7. Complete Request Lifecycle Example**

### **Scenario: User uploads image**

```
[FRONTEND] ← User clicks image upload
├─ File selected: "room.jpg" (2MB)
├─ handleUpload() called in useDesignFlow
├─ Calls: api.uploadRoom(file)
└─ HTTP Request started

[NETWORK] ← Travels to backend
├─ URL: http://127.0.0.1:8000/api/upload
├─ Method: POST
├─ Content-Type: multipart/form-data
├─ Body: binary image data
└─ Headers: [CORS preflight OK ✓]

[BACKEND RECEIVES]
├─ FastAPI router matches: @router.post("/api/upload")
├─ Pydantic extracts: file (UploadFile)
├─ Validation layer:
│  ├─ Check: Content-Type is image/* ✓
│  ├─ Check: File size < 20MB ✓
│  └─ Check: File extension is .jpg/.png/.webp ✓
└─ Route handler triggered

[ROUTE: routes.py::upload_room()]
├─ image_b64 = await validate_and_encode_image(file)
│  └─ Reads file → base64 string → "data:image/jpeg;base64,/9j/4AA..."
├─ state = GraphState(image_base64=image_b64)
│  └─ Auto-generates: job_id = uuid4()
│  └─ Sets: status = JobStatus.PENDING
├─ await job_store.save(state)
│  └─ Stores in memory: { job_id: state }
├─ Call: vision_analyzer_node(state)
│  └─ [Blocking I/O for 10-15 seconds]
└─ Continues to Agent 1...

[AGENT 1: vision_analyzer.py::vision_analyzer_node()]
├─ state.status = JobStatus.ANALYZING
├─ llm = ChatOpenAI(model="gpt-4o")  ← LangChain wrapper
├─ Build HumanMessage:
│  ├─ System prompt: "Analyze this room..."
│  └─ Image: base64-encoded image data
├─ response = llm.invoke([message])
│  └─ [LangChain → OpenAI API → GPT-4o processes]
│  └─ [10-15 second wait]
│  └─ Returns: AIMessage with JSON response
├─ Parse: room_analysis = RoomAnalysis.model_validate_json(...)
│  └─ Pydantic validates JSON structure
│  └─ Raises error if JSON invalid ✗
├─ state.room_analysis = room_analysis
├─ state.status = JobStatus.COMPLETED
└─ return state

[BACK TO ROUTE: routes.py::upload_room()]
├─ await job_store.save(state)  ← Update with room_analysis
├─ Build response: AnalysisResponse(
│  ├─ job_id=state.job_id
│  ├─ room_analysis=state.room_analysis
│  └─ status=state.status
│ )
├─ Serialize: response.model_dump_json()
│  └─ Pydantic converts to JSON string
└─ return JSONResponse(response)

[NETWORK] ← HTTP 200 OK response
├─ URL: http://127.0.0.1:8000/api/upload
├─ Status: 200 OK
├─ Content-Type: application/json
└─ Body: {
   "job_id": "550e8400-e29b-41d4-a716-446655440000",
   "room_analysis": {
     "room_type": "living room",
     "detected_furniture": [
       { "name": "sofa", "keep": true, "condition": "good", ... },
       ...
     ],
     "spatial_notes": "...",
     "lighting": "natural",
     "raw_description": "..."
   },
   "status": "completed"
  }

[FRONTEND RECEIVES]
├─ Fetch promise resolves
├─ HTTP 200 OK ✓
├─ api.ts parseJSON() → JavaScript object
└─ Returns: AnalysisResponse object

[REACT HOOK: useDesignFlow]
├─ setStep("selecting")  ← Update React state
├─ setAnalysis(data.room_analysis)
├─ setJobId(data.job_id)
└─ Trigger re-render

[UI UPDATES]
├─ DesignStudio component re-renders
├─ Shows Step 2: FurnitureChecklist
├─ Displays detected furniture:
│  ├─ ☑ Sofa (detected as good condition)
│  ├─ ☑ TV Stand
│  └─ ☐ Curtains (user can uncheck)
├─ Shows StyleSelector (Modern, Minimalist, etc.)
└─ User sees interactive checklist

[USER INTERACTS]
├─ Uncheck: "Curtains"
├─ Select: "Modern" style
├─ Click: "Generate Design" button
└─ Triggers: handleGenerate()

[CONTINUES TO AGENT 2...]
```

---

## **8. Error Handling & Data Flow**

### **If Something Fails**

```
Scenario: GPT-4o returns invalid JSON

[Agent 1]
├─ llm.invoke() returns: "The room is a living room..."  (NOT JSON)
├─ Pydantic tries: RoomAnalysis.model_validate_json(...)
├─ Validation FAILS ✗
├─ Raises: ValidationError
├─ Caught by try/except in vision_analyzer_node()
├─ Sets: state.status = JobStatus.FAILED
├─ Sets: state.error = str(exception)
└─ return state

[LangGraph Conditional Edge]
├─ should_continue(state) checks:
│  └─ if state.status == JobStatus.FAILED: return "end"
├─ Graph short-circuits
└─ Skips Agent 2

[Route returns]
├─ HTTP 500 Internal Server Error ✗
├─ Body: { "detail": "Invalid JSON from GPT-4o: ..." }
└─ Frontend shows error message

Scenario: Image file too large

[Route: validate_and_encode_image()]
├─ Check: len(file) > 20MB
├─ Raises: HTTPException(status_code=413)
│  └─ "Payload Too Large"
├─ Caught by FastAPI
└─ HTTP 413 response

[Frontend]
├─ api.ts catches error
├─ useDesignFlow sets error state
├─ UI shows: "Image too large (max 20MB)"
```

---

## **9. Technology Integration Summary**

| Technology | Role | How It Fits |
|---|---|---|
| **Next.js 14** | Frontend UI | React components + routing |
| **React Hooks** | State management | useState, custom hooks |
| **Tailwind CSS** | Styling | className-based styling |
| **FastAPI** | HTTP server | Routes, CORS, request validation |
| **Pydantic** | Data models | Type-safe, validated data models |
| **LangChain** | LLM abstraction | Wraps OpenAI API, standardizes messages |
| **LangGraph** | Agent orchestration | DAG state machine for multi-step workflows |
| **OpenAI GPT-4o** | Vision analysis | Analyzes room images, returns structured data |
| **OpenAI DALL-E 3** | Image generation | Generates design render from prompt |
| **Python async/await** | Non-blocking I/O | Handles concurrent requests |
| **Fetch API** | HTTP client | Frontend-to-backend communication |
| **UUID** | Job IDs | Unique identifiers for workflows |
| **Base64** | Image encoding | Encodes binary images for JSON transfer |

---

## **10. Why This Architecture Works**

```
Separation of Concerns:
├─ Frontend: UI/UX, user interactions, React state
├─ Backend: Business logic, AI orchestration, data validation
├─ LLMs: GPT-4o for analysis, DALL-E for rendering
└─ Database: Stores job states (future)

Type Safety Throughout:
├─ Frontend: TypeScript (DesignStyle enum, AnalysisResponse type)
├─ Backend: Pydantic models (GraphState, RoomAnalysis)
├─ HTTP: JSON serialized from Pydantic (guaranteed structure)
└─ Result: Type errors caught early, not at runtime

Stateless HTTP:
├─ Each request is independent
├─ Job IDs enable multi-step workflows
├─ No session maintenance needed
└─ Scales horizontally (multiple instances possible)

Extensibility:
├─ Add new agents: Just add to LangGraph nodes
├─ Add new design styles: Update DesignStyle enum
├─ Swap LLM: Change ChatOpenAI(model=...)
├─ Add database: Replace job_store with DB calls
└─ Add WebSocket: Replace polling with push notifications
```

This is **how everything connects**. Each technology has a specific role, and they interact through well-defined interfaces (HTTP, Pydantic models, LangGraph state machine).
