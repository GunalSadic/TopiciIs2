# OpenAI Prompts Sent in AuraDesign RO

This document shows exactly what prompts are sent to OpenAI at each stage of the design workflow.

---

## **1. DESIGN PLANNER AGENT** 
**File:** `backend/app/agents/design_planner.py`  
**Model:** `gpt-4o` (temperature=0.7, max_tokens=2000)  
**Input:** Room photo + user constraints

### **System Prompt (PLANNER_SYSTEM)**
```
You are a world-class interior designer analyzing a real room photo.
You will return a detailed list of specific design suggestions.

RETURN ONLY VALID JSON with this structure:
{
  "suggestions": [
    {
      "item_type": "<puff|lamp|rug|plant|cushion|art|etc>",
      "description": "<very detailed description for product search>",
      "placement": "<exact placement in room, e.g. 'between desk and window'>",
      "colors": ["<color1>", "<color2>"],
      "style_vibe": "<cozy|modern|luxury|minimalist|scandinavian>",
      "specific_details": "<very specific details like 'umbrella-shaped', 'soft fabric', 'metal frame'>",
      "is_replacement": true/false,
      "target_furniture": "<if replacement, which furniture it replaces>",
      "search_keywords": ["<romanian keyword>", "<keyword>"]
    }
  ],
  "overall_vision": "<2-3 sentence design rationale>"
}

RULES:
1. Provide 5-8 specific design suggestions (mix of replacements and add-ons)
2. Each suggestion MUST have:
   - Specific COLOR(s)
   - Exact PLACEMENT in the room
   - Clear STYLE VIBE
   - Very DETAILED description for product search
3. For replacements (is_replacement: true):
   - target_furniture must be the exact furniture being replaced
   - Only suggest replacements if user didn't mark them as "keep"
4. For add-ons (is_replacement: false):
   - focus on decorative items, lighting, textiles, plants, art
   - be very specific about WHERE and WHAT COLOR
5. Search keywords must be in Romanian language
6. No markdown fences, ONLY valid JSON
```

### **User Prompt (_build_planner_prompt)**
```
Analyze this room photo and create a redesign plan.

Room Analysis (from previous scan):
- Room type: {analysis.room_type}
- Lighting: {analysis.lighting}
- Current furniture: {', '.join(f.name for f in analysis.detected_furniture)}
- Spatial notes: {analysis.spatial_notes}

User Constraints:
- Desired style: {style}
- Furniture to KEEP (do NOT replace these): {', '.join(kept) if kept else 'none — you may replace anything'}
- Budget limit: {f'{state.max_budget:.0f} RON' if state.max_budget else 'no limit'}
- Additional notes: {state.user_notes or 'none'}

Study the photo, then return the JSON redesign plan with exactly 3 items to replace.
```

### **Example Design Planner Output**
```json
{
  "suggestions": [
    {
      "item_type": "puff",
      "description": "White, fluffy ottoman/puff in soft cozy fabric, compact size",
      "placement": "between desk and window",
      "colors": ["white", "cream"],
      "style_vibe": "cozy",
      "specific_details": "soft material, lightweight, perfect for small spaces",
      "is_replacement": false,
      "target_furniture": "",
      "search_keywords": ["puf alb", "ottoman cozy", "puf mic"]
    },
    {
      "item_type": "lamp",
      "description": "Umbrella-shaped desk lamp with brass finish",
      "placement": "top right corner of desk",
      "colors": ["brass", "gold"],
      "style_vibe": "modern",
      "specific_details": "metal umbrella-like canopy, warm light",
      "is_replacement": true,
      "target_furniture": "old desk lamp",
      "search_keywords": ["lampa birou", "lampa umbrella", "lampa alama"]
    }
  ],
  "overall_vision": "Transform this cozy space with warm lighting and soft textures..."
}
```

---

## **2. MARKET AGENT** 
**File:** `backend/app/agents/market_agent.py`  
**Model:** `gpt-4o` (temperature=0.5, max_tokens=1500)  
**Input:** Each design suggestion individually

### **System Prompt (search_system)**
```
You are a Romanian e-commerce expert. For ONE product/item description, search
Romanian online stores and return REAL product links with prices.

You MUST return valid JSON with this structure:
{
  "products": [
    {
      "name": "<product name>",
      "description": "<brief description>",
      "price": <price in RON as number>,
      "currency": "RON",
      "image_url": "<product image URL>",
      "product_url": "<direct product link from store>",
      "store": "<store name (e.g. emag.ro, mobidea.ro)>",
      "rating": <rating 1-5>,
      "in_stock": true/false
    }
  ]
}

Return ONLY valid JSON, no markdown, no extra text.
```

### **User Prompt (search_prompt) - For Each Suggestion**
```
Search for this product on Romanian online stores:

ITEM: {suggestion.item_type.upper()}
DETAILED DESCRIPTION: {suggestion.description}
PLACEMENT: {suggestion.placement}
COLORS: {', '.join(suggestion.colors)}
STYLE: {suggestion.style_vibe}
SPECIFIC DETAILS: {suggestion.specific_details}

SEARCH KEYWORDS (Romanian): {', '.join(suggestion.search_keywords)}

Find 1-2 REAL products from actual Romanian e-commerce stores.
Return direct product links and actual prices.
Include image URLs and store names.
```

### **Example Market Agent Output**
```json
{
  "products": [
    {
      "name": "Puf alb Comfort cozy",
      "description": "Ottoman alb din material moale, 45x45cm",
      "price": 149.99,
      "currency": "RON",
      "image_url": "https://emag.ro/puf-alb-comfort/image.jpg",
      "product_url": "https://emag.ro/puf-alb-comfort/pd/DV123ABC/",
      "store": "emag.ro",
      "rating": 4.7,
      "in_stock": true
    }
  ]
}
```

### **Flow**
1. Design Planner returns 5-8 suggestions
2. For EACH suggestion:
   - Market Agent calls OpenAI with the specific suggestion details
   - OpenAI searches Romanian e-commerce sites
   - Returns product name, price, store, image URL, product URL
   - Backend downloads the product image as base64

---

## **3. ITERATIVE RENDERER (Image Editing)** 
**File:** `backend/app/agents/iterative_renderer.py`  
**Model:** `gpt-image-1` (image editing API)  
**Input:** Current room image + product image + suggestion details

### **Prompt for Product with Image (with product.image_base64)**
```
CRITICAL: Do NOT change the room layout, walls, floor, ceiling, windows, doors, or any existing furniture.

ONLY make this specific change:
At {placement}: Add/place/integrate this product:
{specific_instruction}

Use the product image provided as reference for shape, color, and style.
Keep the exact same lighting and camera angle.
Make it look like a real photo with natural integration.
```

**Where `specific_instruction` is built from the matching suggestion:**
```
{item_type}: {description} ({colors}). 
Details: {specific_details}. 
Style: {style_vibe}
```

### **Example for a Puff:**
```
CRITICAL: Do NOT change the room layout, walls, floor, ceiling, windows, doors, or any existing furniture.

ONLY make this specific change:
At between desk and window: Add/place/integrate this product:
puff: White, fluffy ottoman/puff in soft cozy fabric, compact size (white, cream). 
Details: soft material, lightweight, perfect for small spaces. 
Style: cozy

Use the product image provided as reference for shape, color, and style.
Keep the exact same lighting and camera angle.
Make it look like a real photo with natural integration.
```

### **Prompt for Text-Only (no product.image_base64)**
```
CRITICAL: Do NOT change the room layout, walls, floor, ceiling, windows, doors, or any existing furniture.

ONLY make this specific change:
At {placement}: Add/place this item:
{specific_instruction}

Keep the exact same lighting and camera angle.
Make it look like a real photo.
```

### **Final Decor Prompt (using plan.overall_vision)**
```
CRITICAL: Do NOT change the room layout, walls, floor, or any furniture.

ONLY add small decorative elements based on the design vision:
{plan.overall_vision}

Add subtle touches like lighting effects, shadows, and minor decor if applicable.
Keep the exact same camera angle and perspective.
Make it look like a real photo.
```

---

## **PROMPT FLOW DIAGRAM**

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DESIGN PLANNER                                               │
│    GPT-4o + Room Photo + User Constraints                       │
│    ↓                                                             │
│    Returns: 5-8 Design Suggestions with:                        │
│    - item_type, description, placement, colors, vibe, details   │
└─────────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. MARKET AGENT (FOR EACH SUGGESTION)                           │
│    GPT-4o searches Romanian stores                              │
│    ↓                                                             │
│    Returns: Product name, price, store, image URL               │
│    Then: Downloads product image as base64                      │
└─────────────────────────────────────────────────────────────────┘
           ↓ (FOR EACH PRODUCT)
┌─────────────────────────────────────────────────────────────────┐
│ 3. ITERATIVE RENDERER (EACH ITERATION)                          │
│    GPT-IMAGE-1 edits current image with:                        │
│    - Current room image                                         │
│    - Product image from step 2                                  │
│    - Specific placement + description from step 1               │
│    ↓                                                             │
│    Returns: Edited room image with product integrated           │
└─────────────────────────────────────────────────────────────────┘
           ↓ (repeat for each product)
┌─────────────────────────────────────────────────────────────────┐
│ 4. FINAL DESIGN VISION                                          │
│    GPT-IMAGE-1 final touches using overall_vision from Planner  │
│    ↓                                                             │
│    Returns: Final rendered image ready for display              │
└─────────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND DISPLAYS:                                              │
│ - All intermediate images (thumbnails + carousel)               │
│ - Final rendered image                                          │
│ - Product links from Market Agent                               │
│ - Prices in RON                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## **KEY DESIGN CHOICES IN PROMPTS**

✅ **Design Planner**: Asks for 5-8 suggestions with very specific details (placement, colors, vibe)
✅ **Market Agent**: Searches Romanian sites (emag.ro, mobidea.ro) for real products with live links
✅ **Renderer**: CRITICAL rule - "Do NOT change layout" - focuses on one specific item at a time
✅ **Specificity**: Each renderer prompt includes exact placement + color + style from original suggestion
✅ **Language**: Market Agent uses Romanian keywords for better search results

---

## **API MODELS USED**

- **GPT-4o (Chat)**: Design Planner + Market Agent searches
- **GPT-Image-1**: Iterative image editing (the rendering process)
- **DALL-E 3**: Fallback if GPT-Image-1 fails
