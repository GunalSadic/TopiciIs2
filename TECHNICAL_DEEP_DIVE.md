# AuraDesign RO — Technical Deep Dive

> Design interior alimentat de AI cu produse reale românești.  
> Încarci o fotografie a camerei → primești un render redesenat cu mobilier cumpărabil de pe eMAG, JYSK, Vivre, IKEA RO și Mobexpert.

---

## Cuprins

1. [Arhitectura sistemului](#1-arhitectura-sistemului)
2. [Structura directoarelor](#2-structura-directoarelor)
3. [Fluxul complet al utilizatorului](#3-fluxul-complet-al-utilizatorului)
4. [Backend — Aplicația FastAPI](#4-backend--aplicația-fastapi)
5. [Pipeline LangGraph și Agenți](#5-pipeline-langgraph-și-agenți)
6. [Referință API](#6-referință-api)
7. [Modele de date și scheme](#7-modele-de-date-și-scheme)
8. [Servicii și utilitare backend](#8-servicii-și-utilitare-backend)
9. [Frontend — Pagini și rutare](#9-frontend--pagini-și-rutare)
10. [Frontend — Componente](#10-frontend--componente)
11. [Frontend — Gestiunea stării (useDesignFlow)](#11-frontend--gestiunea-stării-usedesignflow)
12. [Frontend — Client API](#12-frontend--client-api)
13. [Comunicarea Frontend-Backend](#13-comunicarea-frontend-backend)
14. [Servicii externe și API-uri](#14-servicii-externe-și-api-uri)
15. [Configurare și variabile de mediu](#15-configurare-și-variabile-de-mediu)
16. [Detalii tehnice cheie](#16-detalii-tehnice-cheie)

---

## 1. Arhitectura sistemului

```
┌─────────────────────────────────────────────────────────────────────┐
│                       BROWSER UTILIZATOR                            │
│                                                                     │
│   Next.js 14 Frontend (React 18 + TypeScript + Tailwind)           │
│   ┌─────────────┐  ┌─────────────────────────────────────────┐    │
│   │ LandingPage │  │ DesignStudio (hook useDesignFlow)        │    │
│   │  /          │  │  /studio                                 │    │
│   └─────────────┘  └─────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP REST (JSON + FormData)
                                │ NEXT_PUBLIC_API_URL
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Python 3.11+)                   │
│                                                                     │
│  POST /api/upload ──────────────────► Agent 1: Vision Analyzer     │
│  POST /api/source-products ─────────► Agent 2: Design Planner      │
│                                        Agent 3: Market Agent       │
│  POST /api/render-design ───────────► Agent 4: Iterative Renderer  │
│  POST /api/smart-replace ───────────► Agent 4 (un singur slot)     │
│  GET  /api/job/{id} ────────────────► JobStore (în memorie)        │
│                                                                     │
│  JobStore în memorie (GraphState per job_id, asyncio.Lock)         │
└──────────────┬──────────────────┬──────────────────────────────────┘
               │                  │
               │ OpenAI API       │ httpx (web scraping)
               ▼                  ▼
   ┌────────────────────┐   ┌─────────────────────────────────────┐
   │   OpenAI Platform  │   │   Site-uri e-commerce românești     │
   │                    │   │   eMAG / JYSK / Vivre /             │
   │  • GPT-4o Vision   │   │   IKEA RO / Mobexpert / SomProduct  │
   │  • GPT-4o          │   │   (scraping og:image)               │
   │  • gpt-image-1     │   └─────────────────────────────────────┘
   │  • DALL-E 3        │
   │  • web_search_preview│
   └────────────────────┘
```

---

## 2. Structura directoarelor

```
TopiciIs2/
├── README.md
├── TECHNICAL_DEEP_DIVE.md        ← acest fișier
│
├── backend/
│   ├── .env                      ← chei API și config CORS
│   ├── requirements.txt
│   └── app/
│       ├── main.py               ← factory aplicație FastAPI + CORS + startup
│       ├── agents/
│       │   ├── vision_analyzer.py    ← Agent 1: analiza fotografiei camerei
│       │   ├── design_planner.py     ← Agent 2: generarea sugestiilor de design
│       │   ├── market_agent.py       ← Agent 3: căutare produse + scraping imagini
│       │   └── iterative_renderer.py ← Agent 4: editare imagine + randare
│       ├── api/
│       │   └── routes.py             ← toate endpoint-urile HTTP
│       ├── models/
│       │   └── schemas.py            ← toate modelele Pydantic, enum-uri, DTO-uri
│       ├── services/
│       │   ├── graph.py              ← compilarea pipeline-ului LangGraph
│       │   └── storage.py            ← JobStore în memorie
│       ├── utils/
│       │   └── image.py              ← validare imagini + codare base64
│       └── data/
│           └── products.json         ← catalog local de produse (fallback)
│
└── frontend/
    ├── .env.local                ← NEXT_PUBLIC_API_URL
    ├── next.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── package.json
    └── src/
        ├── app/
        │   ├── layout.tsx            ← structura HTML de bază + metadate
        │   ├── page.tsx              ← Rută: / → randează LandingPage
        │   └── studio/
        │       └── page.tsx          ← Rută: /studio → randează DesignStudio
        ├── components/
        │   ├── LandingPage.tsx       ← pagina de marketing (fără props)
        │   ├── DesignStudio.tsx      ← shell-ul principal al aplicației (fără props)
        │   └── ui/
        │       ├── ImageDropzone.tsx     ← upload fișier prin drag-and-drop
        │       ├── FurnitureChecklist.tsx← listă checkbox cu mobilierul detectat
        │       ├── StyleSelector.tsx     ← 11 butoane de stil de design
        │       ├── ProductPreview.tsx    ← revizuire produse găsite înainte de randare
        │       ├── ResultCard.tsx        ← carusel imagini pas cu pas + coș
        │       ├── DesignCart.tsx        ← listă produse + alternative de înlocuire
        │       └── Spinner.tsx           ← stare de încărcare cu mesaj
        ├── hooks/
        │   └── useDesignFlow.ts      ← toată starea aplicației + apelurile API
        ├── lib/
        │   └── api.ts                ← funcții tipizate ale clientului API
        └── types/
            └── index.ts              ← interfețe TypeScript + enum-uri
```

---

## 3. Fluxul complet al utilizatorului

Întreaga aplicație este un **wizard în 4 pași**. Fiecare pas corespunde unuia sau mai multor agenți backend.

```
PAS 1 — Încărcare              PAS 2 — Configurare              PAS 3 — Previzualizare         PAS 4 — Rezultate
────────────────               ────────────────────             ────────────────               ─────────────────
Utilizatorul       →           Utilizatorul alege       →       Utilizatorul revizuiește →     Imaginea camerei
încarcă fotografia             stilul, bifează                  produsele găsite, poate        redesenate cu
                               mobilierul de păstrat,           adăuga/elimina/găsi mai         lista de produse
                               adaugă opțional note             multe produse

POST /api/upload               POST /api/source-products        POST /api/render-design
└─ Rulează Agent 1:            └─ Rulează Agent 2:              └─ Rulează Agent 4:
   analiză vizuală                planificare design               randare iterativă
   Returnează: job_id,         └─ Rulează Agent 3:                (un produs pe rând)
   lista mobilier detectat        căutare web produse
                                  Returnează: lista produse
                                  cu imagini + prețuri
```

### Mașina de stare pas cu pas

Variabila `step` din frontend controlează ce panou UI este vizibil:

| Valoare `step` | Ce se afișează | Ce a declanșat-o |
|---|---|---|
| `"idle"` | ImageDropzone | Încărcare inițială |
| `"uploading"` | Spinner: "Analyzing your room…" | `handleUpload()` apelat |
| `"selecting"` | FurnitureChecklist + StyleSelector | Răspuns upload primit |
| `"sourcing"` | Spinner: "Searching Romanian stores…" | `handleSourceProducts()` apelat |
| `"previewing"` | ProductPreview | Răspuns sourcing primit |
| `"rendering"` | Spinner: "Rendering your design…" | `handleConfirmAndRender()` apelat |
| `"replacing"` | ResultCard (cu overlay de încărcare) | `handleSmartReplace()` apelat |
| `"done"` | ResultCard | Răspuns randare primit |
| `"error"` | Mesaj de eroare + buton Reset | Orice apel API eșuează |

---

## 4. Backend — Aplicația FastAPI

**Fișier:** `backend/app/main.py`

```
FastAPI app
├── CORS middleware
│   └── Origini din variabila de mediu ALLOWED_ORIGINS (implicit: http://localhost:3000)
│   └── Permite toate headerele și metodele
├── router inclus: app.api.routes (prefix: /api)
├── GET /health → { status: "ok", service: "auradesign-ro" }
└── Eveniment startup
    └── Încarcă products.json în catalogul ProductService din memorie
```

Factory-ul aplicației creează o singură instanță `FastAPI()`. Toate rutele de business se află în `routes.py` sub prefixul `/api`. Health check-ul este definit direct pe aplicație.

---

## 5. Pipeline LangGraph și Agenți

**Fișier:** `backend/app/services/graph.py`

Pipeline-ul este un **LangGraph `StateGraph`** — un graf aciclic direcționat unde fiecare nod este o funcție async (agent). Starea partajată este `GraphState`.

```
GraphState (model Pydantic, transmis prin referință prin noduri)
     │
     ▼
┌──────────────────┐
│ vision_analyzer  │  Nodul 1 — rulează întotdeauna
│ (Agent 1)        │  Intrare:  image_base64
│                  │  Ieșire:   room_analysis populat
└────────┬─────────┘
         │ muchie condiționată: FAILED → __end__
         ▼
┌──────────────────┐
│ design_planner   │  Nodul 2 — rulează întotdeauna (dacă nu a eșuat)
│ (Agent 2)        │  Intrare:  room_analysis, desired_style, user_notes, max_budget
│                  │  Ieșire:   design_plan populat
└────────┬─────────┘
         │ muchie condiționată: FAILED → __end__
         ▼
┌──────────────────┐
│ market_agent     │  Nodul 3 — rulează întotdeauna (dacă nu a eșuat)
│ (Agent 3)        │  Intrare:  design_plan, furniture_to_keep, desired_style
│                  │  Ieșire:   sourced_products, alternative_products populate
└────────┬─────────┘
         │ muchie condiționată: FAILED → __end__
         ▼
┌──────────────────┐
│ iterative_renderer│  Nodul 4 — rulează întotdeauna (dacă nu a eșuat)
│ (Agent 4)        │  Intrare:  image_base64, sourced_products, room_analysis
│                  │  Ieșire:   design_proposal populat (imagini, produse)
└────────┬─────────┘
         │
         ▼
      __end__
```

Graful este **compilat o singură dată la startup** și reutilizat pentru toate job-urile. Fiecare job primește propria copie `GraphState` transmisă la `graph.ainvoke()`.

---

### Agent 1 — Vision Analyzer

**Fișier:** `backend/app/agents/vision_analyzer.py`

**Responsabilitate:** Analizează fotografia camerei încărcate folosind GPT-4o Vision.

**Cum funcționează:**
1. Primește `GraphState` cu `image_base64` (base64 pur, fără prefix)
2. Construiește un URL `data:image/jpeg;base64,...` pentru apelul GPT-4o vision
3. Trimite un system prompt care instruiește output JSON strict + un mesaj user cu imaginea
4. Primește JSON cu: `room_type`, `detected_furniture[]`, `spatial_notes`, `lighting`, `raw_description`
5. Parsează JSON-ul în modelul Pydantic `RoomAnalysis`
6. Actualizează `state.room_analysis` și setează `state.status = ANALYZING`

**Apelul OpenAI:**
```python
model = ChatOpenAI(model="gpt-4o", temperature=0, max_tokens=1500)
messages = [SystemMessage(system_prompt), HumanMessage([image_content, text_content])]
response = await model.ainvoke(messages)
```

**Structura output-ului:**
```json
{
  "room_type": "bedroom",
  "detected_furniture": [
    { "name": "desk", "keep": true, "condition": "good", "estimated_position": "left wall" }
  ],
  "spatial_notes": "Two windows on north wall, door on east",
  "lighting": "natural",
  "raw_description": "A compact bedroom with..."
}
```

---

### Agent 2 — Design Planner

**Fișier:** `backend/app/agents/design_planner.py`

**Responsabilitate:** Creează un plan detaliat de design cu sugestii specifice de mobilier, pe baza analizei camerei și preferințelor utilizatorului.

**Cum funcționează:**
1. Citește `state.room_analysis`, `state.desired_style`, `state.user_notes`, `state.max_budget`, `state.image_base64`
2. Construiește un prompt care include tot mobilierul pe care utilizatorul vrea să îl păstreze și constrângerile de buget
3. Trimite imaginea camerei + promptul la GPT-4o (temperature 0.7 pentru creativitate)
4. Primește JSON `{ suggestions: [...], overall_vision: "..." }`
5. Parsează în modelul `DesignPlan`
6. Actualizează `state.design_plan`

**Fiecare sugestie conține:**
```python
{
  "id": "uuid",
  "item_type": "lamp",           # ce tip de mobilier
  "description": "...",          # descriere detaliată pentru căutarea de produse
  "placement": "right corner",   # unde se plasează
  "colors": ["white", "beige"],
  "style_vibe": "minimalist",
  "specific_details": "tall floor lamp with linen shade",
  "is_replacement": false,       # adăugare nouă vs înlocuire existentă
  "target_furniture": "",        # ce piesă existentă înlocuiește
  "search_keywords": ["lampadar alb", "lampa podea"]  # cuvinte cheie în română
}
```

---

### Agent 3 — Market Agent

**Fișier:** `backend/app/agents/market_agent.py`

**Responsabilitate:** Găsește produse reale românești pentru fiecare sugestie de design și descarcă imaginile lor.

**Cum funcționează (per sugestie):**

```
Pentru fiecare sugestie din design_plan.suggestions:
    1. Construiește query de căutare în română din cuvinte cheie + stil + tip mobilier
    2. Apelează OpenAI Responses API cu tool-ul web_search_preview
    3. Parsează rezultatul JSON: name, price, currency, store, image_url, product_url
    4. Validează rezultatul (detecție redirect, potrivire titlu)
    5. Descarcă imaginea produsului via httpx
    6. Codează imaginea în base64 pentru stocare
    7. Creează MatchedProduct cu slot = suggestion.id
```

**Exemplu de construcție query de căutare:**
```
"canapea sectionale moderna gri 2-3 persoane sub 3000 RON"
→ caută pe: eMAG, JYSK, Vivre, IKEA Romania, Mobexpert, SomProduct
```

**Strategii de scraping imagini produse (în ordinea priorității):**
1. Tag meta `og:image` (funcționează pe majoritatea site-urilor e-commerce)
2. Pattern URL CDN eMAG (`s\d+emagst\.akamaized\.net`)
3. Descoperire generică URL imagine din HTML-ul paginii

**Validare imagine:**
- Verifică `Content-Type: image/*`
- Dimensiune minimă fișier: 1000 bytes
- Headere User-Agent și Accept-Language setate pentru locale românesc

**Detecție redirect:**
- Compară tag-ul `<title>` al paginii scraped cu numele produsului așteptat
- Dacă nepotrivirea titlului depășește pragul → link-ul produsului a fost redirecționat → se omite

**Output:** Listă de obiecte `MatchedProduct`, unul per sugestie, stocat în `state.sourced_products`.

---

### Agent 4 — Iterative Renderer

**Fișier:** `backend/app/agents/iterative_renderer.py`

**Responsabilitate:** Editează fotografia camerei, câte un produs pe rând, pentru a produce un redesign fotorealist.

**Cum funcționează:**

```
Pornește cu: imaginea originală a camerei (bytes PNG)

Pentru fiecare produs din sourced_products:
    1. Convertește randul curent în bytes PNG (Pillow)
    2. Convertește imaginea produsului în bytes PNG (din base64)
    3. Creează obiecte fișier în memorie (BytesIO)
    4. Construiește prompt precis de plasare folosind dict-ul _SLOT_TO_PLACEMENT
    5. Apelează API-ul OpenAI gpt-image-1 images.edit():
       - Intrare: imaginea camerei + imaginea produsului
       - Dimensiune: 1536x1024, calitate: high
    6. Salvează imaginea intermediară rezultată (base64)
    7. Înregistrează numele produsului pentru acest pas
    8. Folosește acest output ca intrare pentru produsul următor

Final: state.design_proposal.generated_image_b64 = ultimul render
       state.design_proposal.intermediate_images = toate renderele intermediare
       state.design_proposal.intermediate_products = numele produselor per pas
```

**Exemplu de mapare slot → plasare:**
```python
_SLOT_TO_PLACEMENT = {
    "sofa":     { "placement": "against the main wall, centered", "is_replacement": True },
    "desk_lamp":{ "placement": "on top of the desk, to the right", "is_replacement": False },
    "rug":      { "placement": "centered on the floor under furniture", "is_replacement": False },
    ...
}
```

**Structura promptului pentru fiecare editare:**
```
"Interior design photo editing. Add/Replace [item_type] with the product shown.
Place it [placement]. Maintain exact room geometry, lighting, and all other
furniture unchanged. Photorealistic result."
```

**Lanț de fallback:**
1. `gpt-image-1` images.edit() → primar
2. `DALL-E 3` images.generate() cu descriere completă a camerei → dacă gpt-image-1 eșuează

---

## 6. Referință API

Toate endpoint-urile se află sub prefixul `/api`.

### Upload și analiză

#### `POST /api/upload`
Încarcă fotografia camerei și rulează imediat Agent 1.

| | |
|---|---|
| **Content-Type** | `multipart/form-data` |
| **Body** | `file: File` (JPEG / PNG / WebP, max 10 MB) |
| **Returnează** | `AnalysisResponse` |
| **Erori** | 400 (imagine invalidă), 413 (prea mare), 415 (tip greșit) |

```json
// Răspuns
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "room_analysis": {
    "room_type": "bedroom",
    "detected_furniture": [...],
    "spatial_notes": "...",
    "lighting": "natural",
    "raw_description": "..."
  },
  "status": "analyzing"
}
```

---

### Sourcing produse

#### `POST /api/source-products?job_id={UUID}`
Rulează Agent 2 (Design Planner) apoi Agent 3 (Market Agent). Returnează produsele pentru revizuire înainte de randare.

| | |
|---|---|
| **Content-Type** | `application/json` |
| **Query Param** | `job_id: UUID` |
| **Body** | `DesignRequest` |
| **Returnează** | `SourcingResponse` |

```json
// Body cerere
{
  "desired_style": "Minimalist",
  "furniture_to_keep": ["desk", "wardrobe"],
  "user_notes": "I need more storage",
  "max_budget": 5000.0
}

// Răspuns
{
  "job_id": "...",
  "room_analysis": {...},
  "design_plan": {
    "suggestions": [...],
    "overall_vision": "A calm, clutter-free space..."
  },
  "sourced_products": [
    {
      "product_id": "...", "name": "Canapea gri", "price": 1299.0,
      "currency": "RON", "store": "eMAG", "image_base64": "...",
      "product_url": "https://...", "slot": "sofa"
    }
  ],
  "status": "sourcing"
}
```

---

### Randare

#### `POST /api/render-design?job_id={UUID}`
Rulează Agent 4 pe produsele deja aflate în stare. Nu necesită body de cerere.

| | |
|---|---|
| **Query Param** | `job_id: UUID` |
| **Body** | Niciunul |
| **Returnează** | `DesignResponse` |

```json
// Răspuns
{
  "job_id": "...",
  "room_analysis": {...},
  "design_proposal": {
    "design_rationale": "...",
    "generated_image_b64": "<base64 PNG>",
    "intermediate_images": ["<base64>", "<base64>", ...],
    "intermediate_products": ["sofa", "lamp", ...],
    "matched_products": [...],
    "total_price": 3450.0
  },
  "status": "completed"
}
```

---

### Gestionarea produselor (înainte de randare)

#### `POST /api/add-custom-product?job_id={UUID}`
Adaugă un URL de produs furnizat de utilizator la produsele găsite pentru job.

| | |
|---|---|
| **Body** | `CustomProductRequest` |
| **Returnează** | `{ "product_id": "...", "image_base64": "..." }` |

```json
// Body cerere
{
  "name": "Noptiera IKEA Hemnes",
  "url": "https://www.ikea.com/ro/ro/p/hemnes-...",
  "slot": "nightstand",
  "price": 499.0,
  "currency": "RON",
  "store": "IKEA",
  "image_url": ""
}
```

#### `DELETE /api/remove-sourced-product?job_id={UUID}&product_id={str}`
Elimină un produs din `state.sourced_products`.

#### `POST /api/find-more-products?job_id={UUID}`
Rulează din nou Market Agent și **adaugă** noi alternative. Păstrează produsele existente. Returnează `SourcingResponse` actualizat.

---

### Înlocuire interactivă (după randare)

#### `POST /api/smart-replace?job_id={UUID}`
Înlocuiește un singur produs și rerandează doar acel slot.

| | |
|---|---|
| **Body** | `SmartReplaceRequest` |
| **Returnează** | `DesignResponse` |

```json
// Body cerere
{ "slot": "sofa", "new_product_id": "prod-abc123" }
```

---

### Polling job

#### `GET /api/job/{job_id}`
Returnează starea curentă a unui job. Folosit pentru polling când se utilizează endpoint-ul de fundal `/api/design/full`.

| | |
|---|---|
| **Returnează** | `DesignResponse` |
| **Erori** | 404 dacă job-ul nu este găsit |

---

### Catalog produse

#### `GET /api/products`
Caută în catalogul local de produse.

| Query Param | Tip | Descriere |
|---|---|---|
| `category` | string | ex. "sofa", "lamp" |
| `style` | string | ex. "Modern", "Japandi" |
| `max_price` | float | Prețul maxim în RON |
| `search_term` | string | Căutare după cuvânt cheie în nume/descriere |

#### `GET /api/products/by-category/{category}`
Toate produsele dintr-o categorie.

#### `GET /api/products/by-style/{style}`
Toate produsele care se potrivesc unui stil de design.

#### `GET /api/products/{product_id}`
Un singur produs după ID.

#### `GET /api/products/stats/catalog`
Returnează: număr total, categorii, stiluri, interval prețuri, preț mediu.

---

### Legacy / Conveniență

#### `POST /api/generate-design?job_id={UUID}`
Pipeline complet într-un singur apel sincron (Planner → Market → Renderer). Se preferă fluxul în doi pași.

#### `POST /api/design/full`
Pipeline complet în fundal. Returnează 202 imediat. Faci polling la `/api/job/{id}` pentru rezultate.

---

## 7. Modele de date și scheme

**Fișier:** `backend/app/models/schemas.py`

### Enum-uri

```python
class DesignStyle(str, Enum):
    MODERN       = "Modern"
    MINIMALIST   = "Minimalist"
    LUXURY       = "Luxury"
    SCANDINAVIAN = "Scandinavian"
    JAPANDI      = "Japandi"
    INDUSTRIAL   = "Industrial"
    BOHEMIAN     = "Bohemian"
    ART_DECO     = "Art Deco"
    COASTAL      = "Coastal"
    TRADITIONAL  = "Traditional"
    GAMING_ROOM  = "Gaming Room"

class JobStatus(str, Enum):
    PENDING    = "pending"
    ANALYZING  = "analyzing"
    PLANNING   = "planning"
    SOURCING   = "sourcing"
    RENDERING  = "rendering"
    COMPLETED  = "completed"
    FAILED     = "failed"

class ProductCategory(str, Enum):
    SOFA      = "sofa"
    BED       = "bed"
    TABLE     = "table"
    CHAIR     = "chair"
    CABINET   = "cabinet"
    WARDROBE  = "wardrobe"
    DESK      = "desk"
    SHELF     = "shelf"
    LAMP      = "lamp"
    DECOR     = "decor"
```

---

### Modele analiză cameră (output Agent 1)

```python
class DetectedFurniture(BaseModel):
    name: str                          # "desk", "sofa", "lamp"
    keep: bool = True                  # dacă utilizatorul vrea să îl păstreze
    condition: str = "good"            # "good" | "fair" | "poor"
    estimated_position: str            # "center-left", "against north wall"

class RoomAnalysis(BaseModel):
    room_type: str = ""                # "bedroom", "living room", "office"
    detected_furniture: List[DetectedFurniture] = []
    spatial_notes: str = ""            # ferestre, uși, forma camerei
    lighting: str = ""                 # "natural" | "artificial" | "dark" | "mixed"
    raw_description: str = ""          # rezumat de 2-3 propoziții
```

---

### Modele plan de design (output Agent 2)

```python
class DesignSuggestion(BaseModel):
    id: str                            # UUID — folosit ca identificator slot
    item_type: str                     # "lamp", "rug", "plant", "sofa"
    description: str                   # descriere detaliată pentru căutarea de produse
    placement: str                     # "between desk and window"
    colors: List[str] = []             # ["white", "cream"]
    style_vibe: str = ""               # "cozy", "minimalist"
    specific_details: str = ""         # "umbrella shape, fabric shade"
    is_replacement: bool = False       # True = înlocuiește mobilier existent
    target_furniture: str = ""         # ce piesă înlocuiește
    search_keywords: List[str] = []    # în română: ["lampadar alb", "lampa podea"]

class DesignPlan(BaseModel):
    suggestions: List[DesignSuggestion] = []
    overall_vision: str = ""           # rațiunea de design în 2-3 propoziții
```

---

### Modele produse (output Agent 3)

```python
class ProductDimensions(BaseModel):
    width: str = ""
    depth: str = ""
    height: str = ""
    length: str = ""

class Product(BaseModel):
    id: str
    name: str
    category: ProductCategory | str
    subcategory: str = ""
    price: float
    currency: str = "RON"
    description: str = ""
    styles: List[str] = []             # stilurile de design cu care se potrivește
    materials: List[str] = []
    colors: List[str] = []
    dimensions: ProductDimensions = ProductDimensions()
    image_url: str
    store: str                         # "eMAG", "JYSK", "Vivre", etc.
    product_url: str                   # link direct la pagina produsului
    in_stock: bool = True
    rating: float = 0.0
    reviews: int = 0

class MatchedProduct(BaseModel):
    product_id: str
    name: str
    category: str
    price: float
    currency: str = "RON"
    image_url: str = ""
    image_base64: str = ""             # imaginea descărcată codată în base64
    product_url: str = ""
    store: str = ""
    slot: str = ""                     # ce DesignSuggestion.id completează
    description: str = ""
```

---

### Propunere de design (output Agent 4)

```python
class DesignProposal(BaseModel):
    design_rationale: str = ""
    generated_image_url: str = ""      # URL (dacă disponibil)
    generated_image_b64: str = ""      # PNG base64 al renderului final
    render_steps: List[str] = []       # descrierea fiecărui pas de editare
    intermediate_images: List[str] = []    # PNG base64 per pas
    intermediate_products: List[str] = [] # numele produsului aplicat la fiecare pas
    matched_products: List[MatchedProduct] = []
    suggestions: List[MatchedProduct] = [] # alternative neutilizate
    total_price: float = 0.0
    decor_description: str = ""        # adăugiri de decor generate de AI
```

---

### Starea pipeline-ului

```python
class GraphState(BaseModel):
    # Identitate
    job_id: UUID
    
    # Intrare
    image_base64: str                  # base64 pur, fără prefix data-URL
    image_url: str = ""
    desired_style: DesignStyle = DesignStyle.MODERN
    furniture_to_keep: List[str] = []
    user_notes: str = ""
    max_budget: Optional[float] = None
    
    # Output Agent 1
    room_analysis: RoomAnalysis = RoomAnalysis()
    
    # Output Agent 2
    design_plan: DesignPlan = DesignPlan()
    
    # Output Agent 3
    sourced_products: List[MatchedProduct] = []
    alternative_products: List[MatchedProduct] = []
    
    # Output Agent 4
    current_render_b64: str = ""
    design_proposal: DesignProposal = DesignProposal()
    
    # Metadate
    status: JobStatus = JobStatus.PENDING
    error: str = ""
```

---

### DTO-uri cerere/răspuns API

```python
class DesignRequest(BaseModel):
    desired_style: DesignStyle
    furniture_to_keep: List[str] = []
    user_notes: str = ""
    max_budget: Optional[float] = None

class SmartReplaceRequest(BaseModel):
    slot: str
    new_product_id: str

class CustomProductRequest(BaseModel):
    name: str = "Produs Custom"
    url: str
    slot: str
    price: float = 0.0
    currency: str = "RON"
    store: str = "Custom"
    image_url: str = ""

class AnalysisResponse(BaseModel):
    job_id: UUID
    room_analysis: RoomAnalysis
    status: JobStatus

class SourcingResponse(BaseModel):
    job_id: UUID
    room_analysis: RoomAnalysis
    design_plan: DesignPlan
    sourced_products: List[MatchedProduct] = []
    status: JobStatus

class DesignResponse(BaseModel):
    job_id: UUID
    room_analysis: RoomAnalysis
    design_proposal: DesignProposal
    sourced_products: List[MatchedProduct] = []
    alternative_products: List[MatchedProduct] = []
    status: JobStatus

class ErrorResponse(BaseModel):
    detail: str
    job_id: Optional[UUID] = None
```

---

## 8. Servicii și utilitare backend

### JobStore

**Fișier:** `backend/app/services/storage.py`

Reține toate job-urile active într-un dicționar Python. Deoarece FastAPI este async, accesul este protejat de un `asyncio.Lock`.

```python
class JobStore:
    _store: Dict[str, GraphState] = {}
    _lock: asyncio.Lock

    async def get(job_id: str) -> GraphState | None
    async def set(job_id: str, state: GraphState) -> None
    async def delete(job_id: str) -> None
    async def exists(job_id: str) -> bool
```

**Observație importantă:** Acest store **nu este persistent**. Repornirea serverului șterge toate job-urile. ID-urile de job sunt UUID-uri generate la momentul upload-ului.

---

### ProductService

**Fișier:** `backend/app/agents/market_agent.py` (clasă înglobată)

Încarcă `products.json` la startup și oferă căutare în memorie:

```python
class ProductService:
    def __init__(products_json_path: str)
    def search(category, style, max_price, search_term) -> List[Product]
    def get_by_id(product_id: str) -> Product | None
    def get_by_category(category: str) -> List[Product]
    def get_by_style(style: str) -> List[Product]
    def get_recommendations(room_type: str, style: str) -> List[Product]
    def get_stats() -> Dict
```

Produsele sunt indexate după categorie și stil pentru căutări O(1).

---

### Utilitare imagini

**Fișier:** `backend/app/utils/image.py`

```python
def validate_image(file: UploadFile) -> None
    # Verifică tipul MIME (jpeg, png, webp) → ridică HTTPException 415
    # Verifică dimensiunea fișierului ≤ 10 MB → ridică HTTPException 413

def encode_image_to_base64(image_bytes: bytes) -> str
    # Returnează string base64 pur (fără prefix data-URL)

def downscale_if_needed(image_bytes: bytes, max_px: int = 4096) -> bytes
    # Deschide cu Pillow, redimensionează dacă oricare dimensiune > 4096
    # Păstrează raportul de aspect, recodează ca JPEG
```

---

## 9. Frontend — Pagini și rutare

**Framework:** Next.js 14 (App Router)

| Fișier | Rută | Randează |
|---|---|---|
| `src/app/page.tsx` | `/` | `<LandingPage />` |
| `src/app/studio/page.tsx` | `/studio` | `<DesignStudio />` |
| `src/app/layout.tsx` | (toate) | structura HTML, metadate, CSS global |

`layout.tsx` setează:
- `<title>AuraDesign RO</title>`
- `<meta name="description">`
- `lang="ro"` pe `<html>`
- Importă `globals.css` (baza Tailwind + variabile brand personalizate)

Navigarea între landing și studio folosește componente standard Next.js `<Link>` care trimit spre `/studio`.

---

## 10. Frontend — Componente

### LandingPage

**Fișier:** `frontend/src/components/LandingPage.tsx`  
**Props:** Niciunul

Pagina de marketing cu animații scroll-reveal (IntersectionObserver). Secțiuni:

1. **Hero** — "Redesign-ează camera ta cu AI" + buton CTA → `/studio`
2. **How It Works** — 3 pași: Încarcă → Configurează → Randează
3. **AI Technology** — Explică cei 4 agenți + pipeline-ul LangGraph
4. **Features** — 4 carduri de funcționalități (produse reale, randări iterative, etc.)
5. **Footer CTA** — Alt buton spre `/studio`

Folosește `useEffect` pentru a atașa `IntersectionObserver` pentru animații fade-in la scroll.

---

### DesignStudio

**Fișier:** `frontend/src/components/DesignStudio.tsx`  
**Props:** Niciunul  
**Stare:** Totul din hook-ul `useDesignFlow()`

Shell-ul principal al aplicației. Randează conținut diferit în funcție de `step`:

```tsx
switch (step) {
  case "idle":
    → <ImageDropzone onFile={handleUpload} />

  case "uploading":
    → <Spinner label="Analyzing your room…" />

  case "selecting":
    → <FurnitureChecklist furniture={analysis.room_analysis.detected_furniture}
                           keepList={keepList} onToggle={toggleKeep} />
    → <StyleSelector selected={style} onChange={setStyle} />
    → <button onClick={() => handleSourceProducts(style, notes, budget)}>
         Search products
       </button>

  case "sourcing":
    → <Spinner label="Searching Romanian stores…" />

  case "previewing":
    → <ProductPreview sourcing={sourcing}
                      onConfirm={handleConfirmAndRender}
                      onBack={handleBackToSelecting}
                      onAddCustomProduct={handleAddCustomProduct}
                      onRemoveProduct={handleRemoveProduct}
                      onFindMore={handleFindMoreProducts} />

  case "rendering":
    → <Spinner label="Rendering your design…" />

  case "done" | "replacing":
    → <ResultCard result={result}
                  onReset={reset}
                  onSwapProduct={handleSmartReplace}
                  isReplacing={step === "replacing"} />

  case "error":
    → Mesaj de eroare + buton Reset
}
```

---

### ImageDropzone

**Fișier:** `frontend/src/components/ui/ImageDropzone.tsx`

```tsx
Props:
  onFile: (file: File) => void
  disabled?: boolean
```

- Suportă drag-and-drop + click pentru browse
- Afișează previzualizarea imaginii după selecție (FileReader API → data URL)
- Acceptă: `image/jpeg`, `image/png`, `image/webp`
- Dimensiune maximă impusă client-side: 10 MB

---

### FurnitureChecklist

**Fișier:** `frontend/src/components/ui/FurnitureChecklist.tsx`

```tsx
Props:
  furniture: DetectedFurniture[]
  keepList: Set<string>
  onToggle: (name: string) => void
```

Randează un checkbox pentru fiecare piesă de mobilier detectată. Fiecare element afișează:
- Numele mobilierului
- Badge condiție: `good` / `fair` / `poor` (colorat)
- Poziția estimată (subtitlu)

Bifat = păstrează mobilierul nemodificat. Nebifat = Agent 2 poate sugera înlocuirea lui.

---

### StyleSelector

**Fișier:** `frontend/src/components/ui/StyleSelector.tsx`

```tsx
Props:
  selected: DesignStyle
  onChange: (style: DesignStyle) => void
```

Un grid cu 11 butoane clickabile, unul per `DesignStyle`. Fiecare buton afișează:
- Simbol/emoji pentru stil
- Numele stilului
- Descriere pe un rând

Stilul selectat primește un chenar evidențiat.

---

### ProductPreview

**Fișier:** `frontend/src/components/ui/ProductPreview.tsx`

```tsx
Props:
  sourcing: SourcingResponse
  onConfirm: () => void
  onBack: () => void
  onAddCustomProduct?: (data: CustomProductData) => void
  onRemoveProduct?: (productId: string) => void
  onFindMore?: () => void
```

Permite utilizatorului să revizuiască și să modifice lista de produse înainte de pasul costisitor de randare. Funcționalități:
- Afișează textul `design_plan.overall_vision`
- Listează fiecare produs găsit cu: imagine (din `image_base64`), nume, magazin, preț
- Buton de ștergere per produs
- Buton "Find more products" → apelează `onFindMore`
- Formular pliabil pentru adăugarea unui URL de produs custom (nume, URL, slot, preț, monedă, magazin)
- Calcul total preț în RON
- Confirmare → declanșează randarea | Înapoi → revine la selecția stilului

---

### ResultCard

**Fișier:** `frontend/src/components/ui/ResultCard.tsx`

```tsx
Props:
  result: DesignResponse
  onReset: () => void
  onSwapProduct: (slot: string, newProductId: string) => void
  isReplacing: boolean
```

Afișează randarea finală cu un carusel de imagini pas cu pas:
- **Strip cu thumbnail-uri** ale tuturor `intermediate_images`
- **Vizualizator imagine principal**: afișează imaginea de la pasul selectat
- Fiecare pas etichetat cu produsul adăugat la acel pas (`intermediate_products[i]`)
- **Săgeți navigare** Anterior / Următor
- **Buton descărcare** pentru imaginea finală (declanșează `<a download>` cu PNG base64)
- Text **rațiune design** din `design_proposal.design_rationale`
- **Rezumat analiză cameră**
- Componentă `<DesignCart>` înglobată pentru gestionarea produselor

---

### DesignCart

**Fișier:** `frontend/src/components/ui/DesignCart.tsx`

```tsx
Props:
  matchedProducts: MatchedProduct[]
  suggestions: MatchedProduct[]
  totalPrice: number
  onSwapProduct: (slot: string, newProductId: string) => void
  isReplacing: boolean
```

- Listează toate produsele folosite în render cu: thumbnail, nume, preț, magazin, link la pagina produsului
- Pentru fiecare slot, afișează produse alternative din `suggestions`
- Buton înlocuire → apelează `onSwapProduct(slot, newProductId)` → declanșează smart replace
- Afișează prețul total în RON

---

### Spinner

**Fișier:** `frontend/src/components/ui/Spinner.tsx`

```tsx
Props:
  label: string
```

Spinner CSS animat + text etichetă. Folosit pentru toate stările de încărcare.

---

## 11. Frontend — Gestiunea stării (useDesignFlow)

**Fișier:** `frontend/src/hooks/useDesignFlow.ts`

Acest hook este **singura sursă de adevăr** pentru întregul frontend. `DesignStudio` îl apelează o singură dată la nivel de top și transmite valorile/handlerii în jos la componentele copil.

### Variabile de stare

```typescript
step: "idle" | "uploading" | "selecting" | "sourcing" |
      "previewing" | "rendering" | "replacing" | "done" | "error"

jobId: string | null                  // UUID de la backend, persistent pe parcursul pașilor
error: string | null
analysis: AnalysisResponse | null     // rezultat din /api/upload
sourcing: SourcingResponse | null     // rezultat din /api/source-products
result: DesignResponse | null         // rezultat din /api/render-design
keepList: Set<string>                 // numele mobilierului pe care utilizatorul vrea să îl păstreze
imagePreview: string | null           // data URL pentru afișarea imaginii încărcate
```

### Funcții handler

```typescript
// Pasul 1
handleUpload(file: File): void
  → setează step="uploading"
  → apelează api.uploadRoom(file)
  → la succes: setează analysis, inițializează keepList din mobilierul detectat, step="selecting"
  → la eroare: step="error"

// Pasul 2 → 3
handleSourceProducts(style: DesignStyle, notes: string, maxBudget?: number): void
  → setează step="sourcing"
  → apelează api.sourceProducts(jobId, style, keepList, notes, maxBudget)
  → la succes: setează sourcing, step="previewing"

// Pasul 3 → 4
handleConfirmAndRender(): void
  → setează step="rendering"
  → apelează api.renderDesign(jobId)
  → la succes: setează result, step="done"

// Navigare
handleBackToSelecting(): void
  → setează step="selecting" (păstrează analysis, sourcing este curățat)

// După randare
handleSmartReplace(slot: string, newProductId: string): void
  → setează step="replacing"
  → apelează api.smartReplace(jobId, slot, newProductId)
  → la succes: actualizează result, step="done"

// Gestionare produse (între sourcing și randare)
handleAddCustomProduct(data: CustomProductData): void
  → apelează api.addCustomProduct(jobId, data)
  → actualizează sourcing.sourced_products în starea locală

handleRemoveProduct(productId: string): void
  → apelează api.removeSourcedProduct(jobId, productId)
  → elimină produsul din sourcing.sourced_products în starea locală

handleFindMoreProducts(): void
  → apelează api.findMoreProducts(jobId)
  → adaugă produse noi la sourcing.sourced_products

// Reset
reset(): void
  → curăță toată starea, jobId, step="idle"

// Intern
toggleKeep(name: string): void
  → comută numele mobilierului în Set-ul keepList
```

---

## 12. Frontend — Client API

**Fișier:** `frontend/src/lib/api.ts`

Toate funcțiile folosesc un wrapper tipizat `handleResponse<T>()` care:
1. Verifică `response.ok`
2. Parsează JSON
3. Aruncă `Error` cu mesajul din `{ detail }` dacă nu e ok

URL de bază din: `process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"`

```typescript
uploadRoom(file: File): Promise<AnalysisResponse>
  → POST /api/upload  (FormData)

sourceProducts(jobId, style, keep, notes, budget): Promise<SourcingResponse>
  → POST /api/source-products?job_id={jobId}  (JSON body: DesignRequest)

renderDesign(jobId): Promise<DesignResponse>
  → POST /api/render-design?job_id={jobId}  (fără body)

generateDesign(jobId, style, keep, notes, budget): Promise<DesignResponse>
  → POST /api/generate-design?job_id={jobId}  (JSON body: DesignRequest)

smartReplace(jobId, slot, productId): Promise<DesignResponse>
  → POST /api/smart-replace?job_id={jobId}  (JSON body: SmartReplaceRequest)

addCustomProduct(jobId, product): Promise<{product_id: string, image_base64?: string}>
  → POST /api/add-custom-product?job_id={jobId}  (JSON body: CustomProductRequest)

removeSourcedProduct(jobId, productId): Promise<void>
  → DELETE /api/remove-sourced-product?job_id={jobId}&product_id={productId}

findMoreProducts(jobId): Promise<SourcingResponse>
  → POST /api/find-more-products?job_id={jobId}

pollJob(jobId): Promise<DesignResponse>
  → GET /api/job/{jobId}
```

---

## 13. Comunicarea Frontend-Backend

### Diagrama fluxului de date

```
Browser                             FastAPI                          OpenAI
───────                             ───────                          ──────

1. Utilizatorul încarcă imaginea
   POST /api/upload ──────────────► validează imaginea
                                    codează în base64
                                    creează job_id
                                    stochează în JobStore
                                    rulează Agent 1 ───────────────► GPT-4o Vision
                                                    ◄──────────────── room_analysis JSON
   ◄───────────── AnalysisResponse
   (job_id + mobilier detectat)

2. Utilizatorul alege stilul, apasă Caută
   POST /api/source-products ──────► încarcă starea din JobStore
                                     rulează Agent 2 ───────────────► GPT-4o
                                                     ◄──────────────── plan design JSON
                                     rulează Agent 3 ───────────────► web_search_preview
                                                     ◄──────────────── produs JSON × N
                                                     → scrape og:image × N (httpx)
                                                     → descarcă imagini × N
   ◄───────────── SourcingResponse
   (produse cu imagini + prețuri)

3. Utilizatorul revizuiește, apasă Randează
   POST /api/render-design ────────► încarcă starea din JobStore
                                     rulează Agent 4:
                                       pentru fiecare produs:     → API gpt-image-1 edit
                                         salvează imagine intermediară ◄── PNG editat
   ◄───────────── DesignResponse
   (render final + toate imaginile intermediare)

4. Utilizatorul înlocuiește un produs
   POST /api/smart-replace ────────► încarcă starea din JobStore
                                     înlocuiește produsul în sourced_products
                                     rulează Agent 4 (un slot)   → API gpt-image-1 edit
   ◄───────────── DesignResponse
   (render actualizat)
```

### Formatul de transfer al imaginilor

Imaginile sunt transferate ca **string-uri base64** în interiorul body-urilor JSON:
- Fotografia camerei: stocată în `GraphState.image_base64`, niciodată trimisă înapoi la frontend
- Imaginile produselor: stocate în `MatchedProduct.image_base64`, trimise în `SourcingResponse`
- Rezultatele randării: stocate în `DesignProposal.generated_image_b64` și `intermediate_images`, trimise în `DesignResponse`

Frontend-ul le randează direct în `<img src="data:image/png;base64,..." />`.

---

## 14. Servicii externe și API-uri

### OpenAI — GPT-4o Vision (Agent 1)

- **SDK:** `langchain_openai.ChatOpenAI`
- **Model:** `gpt-4o`
- **Config:** `temperature=0`, `max_tokens=1500`
- **Intrare:** Imagine base64 ca `data:image/jpeg;base64,...` + prompt text
- **Ieșire:** JSON structurat (parsat manual din textul răspunsului)

### OpenAI — GPT-4o Text (Agent 2)

- **SDK:** `langchain_openai.ChatOpenAI`
- **Model:** `gpt-4o`
- **Config:** `temperature=0.7`, `max_tokens=2000`
- **Intrare:** Imaginea camerei + analiza camerei + preferințele utilizatorului
- **Ieșire:** JSON structurat (parsat manual din textul răspunsului)

### OpenAI — Responses API / web_search_preview (Agent 3)

- **SDK:** `openai.OpenAI().responses.create()`
- **Tool:** `web_search_preview`
- **Site-uri țintă:** eMAG, JYSK, Vivre, IKEA Romania, Mobexpert, SomProduct
- **Timeout:** 90 secunde per apel
- **Ieșire:** JSON produs (name, price, currency, store, image_url, product_url)

### OpenAI — gpt-image-1 (Agent 4, primar)

- **SDK:** `openai.AsyncOpenAI().images.edit()`
- **Model:** `gpt-image-1`
- **Config:** `size="1536x1024"`, `quality="high"`
- **Intrare:** Camera PNG + produsul PNG ca formular multipart + prompt text
- **Ieșire:** PNG base64 al camerei editate

### OpenAI — DALL-E 3 (Agent 4, fallback)

- **SDK:** `openai.AsyncOpenAI().images.generate()`
- **Model:** `dall-e-3`
- **Config:** `size="1792x1024"`, `quality="hd"`
- **Declanșator:** Doar când gpt-image-1 aruncă o excepție
- **Intrare:** Descriere text completă a camerei dorite (fără intrare imagine)

### Site-uri e-commerce românești (web scraping)

Agent 3 scrape-uiește imagini de produse de pe:

| Magazin | Domeniu |
|---|---|
| eMAG | emag.ro |
| JYSK | jysk.ro |
| Vivre | vivre.ro |
| IKEA Romania | ikea.com/ro/ro |
| Mobexpert | mobexpert.ro |
| SomProduct | somproduct.ro |

Scraping-ul folosește `httpx` cu headere browser românești (`Accept-Language: ro-RO`). Nu sunt necesare autentificare sau chei API.

---

## 15. Configurare și variabile de mediu

### Backend — `backend/.env`

```bash
OPENAI_API_KEY=sk-...              # Obligatoriu. Cheia API OpenAI.
ALLOWED_ORIGINS=http://localhost:3000  # Origini permise CORS. Separate prin virgulă.
LOG_LEVEL=INFO                     # Nivel logging Python.
```

### Frontend — `frontend/.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000  # URL de bază backend. Fără slash final.
```

Prefixul `NEXT_PUBLIC_` face această variabilă disponibilă în codul client-side via `process.env.NEXT_PUBLIC_API_URL`.

---

## 16. Detalii tehnice cheie

### De ce randare iterativă (un produs pe rând)?

În loc să cerem AI-ului să înlocuiască tot mobilierul într-un singur apel, Agent 4 aplică produsele secvențial. Acest lucru previne modelul să "uite" elementele plasate anterior și produce randări mai consistente și mai coerente. Output-ul fiecărui pas devine imaginea de intrare pentru pasul următor.

### De ce `gpt-image-1` față de DALL-E 3 pentru editare?

`gpt-image-1` acceptă atât o imagine a camerei, cât și o imagine a produsului ca intrare și face **editare în context** — poate înțelege "plasează acest produs specific în această cameră." DALL-E 3 poate genera doar din descrieri text și este folosit ca fallback când API-ul de editare eșuează.

### De ce imaginile sunt transferate ca base64?

Toate cele trei tipuri (fotografia încărcată, imaginile produselor, rezultatele randate) sunt stocate ca string-uri base64 în interiorul modelului Pydantic `GraphState`. Aceasta evită necesitatea unui serviciu separat de stocare fișiere (S3, GCS) și menține sistemul autoconținut. Compromisul este payload-uri JSON mai mari (~1–3 MB per imagine) și lipsa persistenței la repornire.

### De ce `asyncio.Lock` pe JobStore?

FastAPI gestionează cererile concurent via asyncio. Fără lock, două cereri simultane pentru același job (ex. polling + randare) ar putea cauza race conditions la citirea/scrierea `GraphState`. Lock-ul asigură acces atomic per job.

### Cum funcționează "slot"-ul pe parcursul pipeline-ului?

`DesignSuggestion.id` (un UUID generat de Agent 2) este identificatorul de slot. Agent 3 asignează `MatchedProduct.slot = suggestion.id` când găsește un produs pentru acea sugestie. Agent 4 folosește slot-ul pentru a construi prompturi precise de plasare via `_SLOT_TO_PLACEMENT`. Smart replace folosește de asemenea slot-ul pentru a ști ce produs să înlocuiască.

### Detecția de redirect în Agent 3

Site-urile e-commerce românești uneori redirecționează URL-urile de căutare către pagini de categorie sau pagini principale. Agent 3 detectează acest lucru comparând tag-ul `<title>` al paginii scraped cu numele produsului așteptat. Dacă nepotrivirea este prea mare, produsul este omis și se încearcă o nouă căutare.

### Maparea Mobilier → Categorie

`market_agent.py` conține `_FURNITURE_TO_CATEGORY` — un dicționar care mapează ~50 de nume de mobilier în engleză și română la valorile enum `ProductCategory`. Aceasta asigură că "noptieră" se mapează la aceeași categorie ca "nightstand" pentru căutări consistente în catalogul de produse.

### Limitările store-ului în memorie

`JobStore` reține toate obiectele `GraphState` în RAM pe durata de viață a procesului server. La repornire, toate job-urile se pierd. Aceasta este intenționat pentru un prototip — un sistem de producție ar folosi Redis sau o bază de date. Fiecare job de randare ocupă ~5–15 MB de imagini codificate base64, deci utilizarea memoriei crește odată cu job-urile active.
