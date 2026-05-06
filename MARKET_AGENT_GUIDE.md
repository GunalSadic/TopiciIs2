# **Market Agent API — Usage Guide**

## **Overview**

The Market Agent is a service that manages a product catalog and provides search/filter functionality. It simulates a database of real products from Romanian e-commerce platforms (Mobidea, eMAG, SomProduct, etc.).

## **Architecture**

```
ProductService (in-memory database)
    ├─ Loads products from app/data/products.json
    ├─ Indexes by: category, style, price
    └─ Provides: search, filter, recommendations
        ↓
FastAPI Routes (/api/products/*)
    ├─ GET /api/products (search with filters)
    ├─ GET /api/products/{id} (get single product)
    ├─ GET /api/products/by-category/{category}
    ├─ GET /api/products/by-style/{style}
    └─ GET /api/products/stats/catalog
```

## **API Endpoints**

### **1. Search Products (with filters)**

```http
GET /api/products?category=sofa&style=Modern&max_price=2500

Query Parameters:
  - category (optional): "sofa", "bed", "table", "chair", "cabinet", "wardrobe", "desk", "shelf", "lamp", "decor"
  - style (optional): "Modern", "Minimalist", "Luxury", "Scandinavian", etc.
  - max_price (optional): maximum price in RON
  - search_term (optional): search by name or description
```

**Response:**
```json
{
  "products": [
    {
      "id": "prod_001",
      "name": "Dressing dormitor de colt Stejar Auriu",
      "category": "wardrobe",
      "subcategory": "corner_wardrobe",
      "price": 1299.99,
      "currency": "RON",
      "description": "...",
      "styles": ["Modern", "Minimalist"],
      "materials": ["Wood", "Oak"],
      "colors": ["White", "White with Grey", "Golden Oak"],
      "dimensions": {
        "width": "86.8-89 cm",
        "depth": "48 cm",
        "height": "192.5 cm"
      },
      "image_url": "https://...",
      "store": "Mobidea",
      "product_url": "https://mobidea.ro/...",
      "in_stock": true,
      "rating": 4.5,
      "reviews": 12
    }
  ],
  "total": 1,
  "query": {
    "category": "wardrobe",
    "style": "Modern",
    "max_price": 2500,
    "search_term": null
  }
}
```

---

### **2. Get Single Product**

```http
GET /api/products/prod_001

Response:
{
  "id": "prod_001",
  "name": "Dressing dormitor de colt Stejar Auriu",
  "category": "wardrobe",
  ...
}
```

---

### **3. Get Products by Category**

```http
GET /api/products/by-category/sofa

Response:
[
  { product object },
  { product object },
  ...
]
```

**Available categories:** sofa, bed, table, chair, cabinet, wardrobe, desk, shelf, lamp, decor

---

### **4. Get Products by Style**

```http
GET /api/products/by-style/Modern

Response:
[
  { product object },
  { product object },
  ...
]
```

**Available styles:** Modern, Minimalist, Luxury, Scandinavian, Contemporary, Gaming Room

---

### **5. Get Catalog Statistics**

```http
GET /api/products/stats/catalog

Response:
{
  "total_products": 5,
  "total_categories": 6,
  "total_styles": 5,
  "categories": ["bed", "cabinet", "sofa", "table", "wardrobe"],
  "styles": ["Contemporary", "Minimalist", "Modern", "Scandinavian"],
  "avg_price": 1249.89,
  "price_range": {
    "min": 449.99,
    "max": 2199.00
  }
}
```

---

## **Usage Examples**

### **Example 1: Find Modern Sofas Under 3000 RON**

```bash
curl "http://127.0.0.1:8000/api/products?category=sofa&style=Modern&max_price=3000"
```

### **Example 2: Search for All Products Matching "Oak"**

```bash
curl "http://127.0.0.1:8000/api/products?search_term=oak"
```

### **Example 3: Get All Products in the "Bed" Category**

```bash
curl "http://127.0.0.1:8000/api/products/by-category/bed"
```

### **Example 4: Find Products with "Minimalist" Style**

```bash
curl "http://127.0.0.1:8000/api/products/by-style/Minimalist"
```

---

## **Python Code Example**

```python
import requests

# Initialize
BASE_URL = "http://127.0.0.1:8000/api"

# 1. Search products
response = requests.get(
    f"{BASE_URL}/products",
    params={
        "category": "sofa",
        "style": "Modern",
        "max_price": 2500
    }
)
products = response.json()["products"]
print(f"Found {len(products)} modern sofas under 2500 RON")

# 2. Get product details
product_id = products[0]["id"]
response = requests.get(f"{BASE_URL}/products/{product_id}")
product = response.json()
print(f"Product: {product['name']}")
print(f"Price: {product['price']} {product['currency']}")
print(f"Store: {product['store']}")
print(f"URL: {product['product_url']}")

# 3. Get catalog stats
response = requests.get(f"{BASE_URL}/products/stats/catalog")
stats = response.json()
print(f"Total products: {stats['total_products']}")
print(f"Categories: {', '.join(stats['categories'])}")
```

---

## **ProductService Class (In-Memory Database)**

### **Core Methods**

```python
from app.agents.market_agent import ProductService, get_product_service

# Get singleton instance
service = get_product_service()

# 1. Search with filters
from app.models.schemas import ProductSearchRequest
request = ProductSearchRequest(
    category="sofa",
    style="Modern",
    max_price=2500,
    search_term=None
)
result = service.search(request)
# Returns: ProductSearchResponse(products=[...], total=1, query={...})

# 2. Get single product
product = service.get_product("prod_001")
# Returns: Product object or None

# 3. Search by category
products = service.search_by_category("sofa")
# Returns: list[Product]

# 4. Search by style
products = service.search_by_style("Modern")
# Returns: list[Product]

# 5. Search by price range
products = service.search_by_price_range(min_price=500, max_price=2000)
# Returns: list[Product]

# 6. Get recommendations
recommendations = service.get_recommendations(
    room_analysis={"room_type": "living room"},
    style="Modern",
    excluded_ids=[]
)
# Returns: list[Product] (top 10 by rating)

# 7. Get all categories
categories = service.get_all_categories()
# Returns: ["bed", "cabinet", "sofa", "table", ...]

# 8. Get all styles
styles = service.get_all_styles()
# Returns: ["Modern", "Minimalist", "Luxury", ...]

# 9. Get statistics
stats = service.get_stats()
# Returns: dict with total_products, categories, styles, price_range, etc.
```

---

## **Adding New Products**

### **Method 1: Add to JSON File**

Edit `backend/app/data/products.json` and add new products to the `"products"` array:

```json
{
  "id": "prod_006",
  "name": "New Product Name",
  "category": "sofa",
  "subcategory": "leather_sofa",
  "price": 3499.99,
  "currency": "RON",
  "description": "Product description...",
  "styles": ["Modern", "Luxury"],
  "materials": ["Genuine Leather"],
  "colors": ["Black", "Brown"],
  "dimensions": {
    "width": "240 cm",
    "depth": "100 cm",
    "height": "85 cm"
  },
  "image_url": "https://example.com/image.jpg",
  "store": "Mobidea",
  "product_url": "https://mobidea.ro/product/",
  "in_stock": true,
  "rating": 4.8,
  "reviews": 32
}
```

Then restart the backend. The ProductService will automatically load the new products.

### **Method 2: Add via Python Code**

```python
from app.models.schemas import Product, ProductDimensions
from app.agents.market_agent import get_product_service

service = get_product_service()

# Add product programmatically
new_product = Product(
    id="prod_007",
    name="New Modern Chair",
    category="chair",
    subcategory="accent_chair",
    price=599.99,
    description="Comfortable and stylish modern chair",
    styles=["Modern"],
    materials=["Fabric", "Wood"],
    colors=["Grey", "Black"],
    dimensions=ProductDimensions(
        width="80 cm",
        depth="85 cm",
        height="90 cm"
    ),
    image_url="https://...",
    store="eMAG",
    product_url="https://emag.ro/..."
)

# Manually add to service (Note: this doesn't persist to JSON)
service.products[new_product.id] = new_product
# Index by category
if "chair" not in service.categories:
    service.categories["chair"] = []
service.categories["chair"].append(new_product.id)
# Index by styles
for style in new_product.styles:
    if style not in service.styles:
        service.styles[style] = []
    service.styles[style].append(new_product.id)
```

---

## **Integration with Vision & Design Agents**

### **Vision Agent → Market Agent**

```python
# In vision_analyzer.py or interior_designer.py
from app.agents.market_agent import get_product_service

service = get_product_service()

# Get furniture recommendations based on style
room_style = "Modern"  # from room analysis
products = service.search_by_style(room_style)

# Or search by category
sofas = service.search_by_category("sofa")

# Filter by price
cheap_tables = service.search_by_price_range(min_price=0, max_price=500)
```

---

## **Current Limitations**

1. **In-Memory Only** — Products are loaded into memory at startup. Restarts lose any programmatic changes.
2. **No Pagination** — All results returned at once (OK for MVP with ~100 products).
3. **No Persistence** — Database changes don't write back to JSON.
4. **No Real-Time Updates** — Needs restart to load new JSON data.

---

## **Future Enhancements**

1. **Replace with Database**
   - PostgreSQL + SQLAlchemy
   - Supabase
   - MongoDB

2. **Add Pagination**
   ```python
   search(..., skip=0, limit=20)
   ```

3. **Add Vector Search (CLIP)**
   - Index products by visual embeddings
   - Find visually similar products

4. **Add Real-Time Updates**
   - Watch products.json for changes
   - Hot-reload on file update

5. **Add Affiliate Tracking**
   - Generate tracking URLs for each product link
   - Measure conversions

---

## **Testing the Market Agent**

### **Option 1: Swagger UI**

1. Start backend: `uvicorn app.main:app --reload`
2. Open: http://127.0.0.1:8000/docs
3. Scroll to "Market Agent" section
4. Click "Try it out" on any endpoint

### **Option 2: cURL**

```bash
# Search for modern sofas
curl -X GET "http://127.0.0.1:8000/api/products?category=sofa&style=Modern" \
  -H "accept: application/json"

# Get catalog stats
curl -X GET "http://127.0.0.1:8000/api/products/stats/catalog" \
  -H "accept: application/json"
```

### **Option 3: Python Requests**

```python
import requests

response = requests.get("http://127.0.0.1:8000/api/products/stats/catalog")
print(response.json())
```

---

## **Next Steps**

1. ✅ ProductService created and tested
2. ⏳ Integrate with Inpainting Agent (Smart Replace)
3. ⏳ Add real product image matching (CLIP embeddings)
4. ⏳ Create affiliate tracking URLs
5. ⏳ Migrate to persistent database
