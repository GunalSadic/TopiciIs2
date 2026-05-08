"""
Market Agent — Searches Romanian e-commerce catalog for products
matching the Design Planner's descriptions, and downloads product images
so the iterative renderer can use them.
"""
from __future__ import annotations

import base64
import json
import logging
from io import BytesIO
from pathlib import Path
from typing import Any

import httpx

from app.models.schemas import (
    GraphState,
    JobStatus,
    MatchedProduct,
    Product,
    ProductCategory,
    ProductSearchRequest,
    ProductSearchResponse,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# ProductService — in-memory product database
# ---------------------------------------------------------------------------

class ProductService:
    """
    In-memory product database service.
    Loads product catalog from JSON and provides search/filter capabilities.
    """

    def __init__(self, products_json_path: str | None = None):
        self.products: dict[str, Product] = {}
        self.categories: dict[str, list[str]] = {}
        self.styles: dict[str, list[str]] = {}

        if products_json_path is None:
            products_json_path = Path(__file__).parent.parent / "data" / "products.json"

        self._load_products(products_json_path)
        logger.info(f"ProductService initialized with {len(self.products)} products")

    def _load_products(self, json_path: str | Path) -> None:
        json_path = Path(json_path)
        if not json_path.exists():
            logger.warning(f"Products file not found: {json_path}")
            return

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            for product_data in data.get("products", []):
                product = Product(**product_data)
                self.products[product.id] = product

                category = str(product.category)
                if category not in self.categories:
                    self.categories[category] = []
                self.categories[category].append(product.id)

                for style in product.styles:
                    if style not in self.styles:
                        self.styles[style] = []
                    self.styles[style].append(product.id)

            logger.info(f"Loaded {len(self.products)} products from {json_path}")
        except Exception as e:
            logger.error(f"Error loading products: {e}")

    def get_product(self, product_id: str) -> Product | None:
        return self.products.get(product_id)

    def search(self, request: ProductSearchRequest) -> ProductSearchResponse:
        candidates = set(self.products.keys())

        if request.category:
            category_ids = self.categories.get(request.category.lower(), [])
            candidates &= set(category_ids)

        if request.style:
            style_ids = self.styles.get(request.style, [])
            candidates &= set(style_ids)

        if request.max_price is not None:
            candidates = {
                pid for pid in candidates
                if self.products[pid].price <= request.max_price
            }

        if request.search_term:
            term = request.search_term.lower()
            candidates = {
                pid for pid in candidates
                if term in self.products[pid].name.lower()
                or term in self.products[pid].description.lower()
                or any(term in kw.lower() for kw in self.products[pid].colors)
                or any(term in kw.lower() for kw in self.products[pid].materials)
            }

        results = [self.products[pid] for pid in sorted(candidates)]
        return ProductSearchResponse(
            products=results,
            total=len(results),
            query={
                "category": request.category,
                "style": request.style,
                "max_price": request.max_price,
                "search_term": request.search_term,
            }
        )

    def search_by_category(self, category: str) -> list[Product]:
        product_ids = self.categories.get(category.lower(), [])
        return [self.products[pid] for pid in product_ids]

    def search_by_style(self, style: str) -> list[Product]:
        product_ids = self.styles.get(style, [])
        return [self.products[pid] for pid in product_ids]

    def search_by_price_range(self, min_price: float = 0, max_price: float = float("inf")) -> list[Product]:
        return [p for p in self.products.values() if min_price <= p.price <= max_price]

    def get_recommendations(self, room_analysis: dict[str, Any], style: str, excluded_ids: list[str] | None = None) -> list[Product]:
        excluded = set(excluded_ids or [])
        style_products = [
            self.products[pid]
            for pid in self.styles.get(style, [])
            if pid not in excluded
        ]
        style_products.sort(key=lambda p: p.rating, reverse=True)
        return style_products[:10]

    def get_all_categories(self) -> list[str]:
        return sorted(self.categories.keys())

    def get_all_styles(self) -> list[str]:
        return sorted(self.styles.keys())

    def get_stats(self) -> dict[str, Any]:
        return {
            "total_products": len(self.products),
            "total_categories": len(self.categories),
            "total_styles": len(self.styles),
            "categories": self.get_all_categories(),
            "styles": self.get_all_styles(),
            "avg_price": sum(p.price for p in self.products.values()) / len(self.products) if self.products else 0,
            "price_range": {
                "min": min((p.price for p in self.products.values()), default=0),
                "max": max((p.price for p in self.products.values()), default=0),
            }
        }


# Singleton
_product_service: ProductService | None = None


def get_product_service() -> ProductService:
    global _product_service
    if _product_service is None:
        _product_service = ProductService()
    return _product_service


def initialize_product_service(json_path: str | None = None) -> ProductService:
    global _product_service
    _product_service = ProductService(json_path)
    return _product_service


# ---------------------------------------------------------------------------
# Furniture name → category mapping
# ---------------------------------------------------------------------------

_FURNITURE_TO_CATEGORY: dict[str, str] = {
    "sofa": "sofa", "couch": "sofa", "canapea": "sofa", "loveseat": "sofa",
    "bed": "bed", "pat": "bed",
    "table": "table", "masa": "table", "coffee table": "table", "dining table": "table",
    "desk": "desk", "birou": "desk",
    "chair": "chair", "scaun": "chair", "armchair": "chair", "fotoliu": "chair",
    "wardrobe": "wardrobe", "closet": "wardrobe", "dulap": "wardrobe", "dressing": "wardrobe",
    "cabinet": "cabinet", "shelf": "shelf", "raft": "shelf", "bookshelf": "shelf",
    "lamp": "lamp", "lampa": "lamp", "light": "lamp", "chandelier": "lamp",
    "nightstand": "cabinet", "noptiera": "cabinet",
}


def _guess_category(slot: str, keywords: list[str]) -> str | None:
    """Best-effort mapping from a slot name / keywords to a product category."""
    for text in [slot] + keywords:
        text_lower = text.lower().strip()
        for keyword, category in _FURNITURE_TO_CATEGORY.items():
            if keyword in text_lower:
                return category
    return None


_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8",
    "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
}


def _extract_image_from_product_page(
    product_url: str,
    expected_name: str = "",
    timeout: float = 15.0,
) -> str:
    """
    Scrape the product page HTML and extract the main product image URL
    from og:image meta tag or common e-commerce image patterns.

    If expected_name is provided, verifies the page title contains at least
    one significant word from the expected product name. This catches eMAG's
    301 redirects to completely different products (e.g. pillows → sweaters).

    Returns the image URL or '' on failure.
    """
    import re

    if not product_url:
        return ""

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True, headers=_BROWSER_HEADERS) as client:
            resp = client.get(product_url)
            resp.raise_for_status()

        html = resp.text
        final_url = str(resp.url)

        # ---- Redirect verification ----
        # If the page redirected (eMAG does this with stale IDs), check that
        # the page title still matches the product we were looking for.
        if expected_name and final_url != product_url:
            # Extract og:title or <title> from the page
            title_match = re.search(
                r'<meta\s+(?:property|name)=["\']og:title["\']\s+content=["\']([^"\']+)["\']',
                html, re.IGNORECASE,
            )
            if not title_match:
                title_match = re.search(
                    r'<meta\s+content=["\']([^"\']+)["\']\s+(?:property|name)=["\']og:title["\']',
                    html, re.IGNORECASE,
                )
            if not title_match:
                title_match = re.search(r'<title>([^<]+)</title>', html, re.IGNORECASE)

            if title_match:
                page_title = title_match.group(1).lower()
                # Check if at least one significant word (4+ chars) from the
                # expected product name appears in the page title
                significant_words = [
                    w for w in expected_name.lower().split()
                    if len(w) >= 4 and w not in {"pentru", "care", "este", "acest", "doar", "from", "with"}
                ]
                match_count = sum(1 for w in significant_words if w in page_title)

                if significant_words and match_count == 0:
                    logger.warning(
                        "Redirect mismatch! Expected '%s' but page title is '%s' (URL: %s → %s). Rejecting.",
                        expected_name[:60], page_title[:80], product_url[:60], final_url[:60],
                    )
                    return ""
                else:
                    logger.info(
                        "Redirect OK — %d/%d keyword matches (title: '%s')",
                        match_count, len(significant_words), page_title[:60],
                    )

        # ---- Image extraction ----

        # Strategy 1: og:image meta tag (most reliable — every store has it)
        og_match = re.search(
            r'<meta\s+(?:property|name)=["\']og:image["\']\s+content=["\']([^"\']+)["\']',
            html, re.IGNORECASE,
        )
        if not og_match:
            og_match = re.search(
                r'<meta\s+content=["\']([^"\']+)["\']\s+(?:property|name)=["\']og:image["\']',
                html, re.IGNORECASE,
            )

        if og_match:
            img_url = og_match.group(1)
            logger.info("Extracted og:image from product page: %s", img_url)
            return img_url

        # Strategy 2: eMAG specific — look for high-res product image pattern
        emag_match = re.search(
            r'(https://s\d+emagst\.akamaized\.net/products/[^"\'>\s]+\.(?:jpg|png|webp))',
            html, re.IGNORECASE,
        )
        if emag_match:
            img_url = emag_match.group(1)
            logger.info("Extracted eMAG CDN image: %s", img_url)
            return img_url

        # Strategy 3: Generic — find the first large product image
        img_matches = re.findall(
            r'(https?://[^"\'>\s]+\.(?:jpg|jpeg|png|webp))',
            html, re.IGNORECASE,
        )
        for candidate in img_matches:
            skip_keywords = ["logo", "icon", "pixel", "tracking", "banner", "sprite", "favicon", "svg"]
            if not any(kw in candidate.lower() for kw in skip_keywords):
                logger.info("Extracted fallback image from product page: %s", candidate)
                return candidate

        logger.warning("No image found on product page: %s", product_url)
        return ""

    except Exception as exc:
        logger.warning("Failed to scrape product page %s: %s", product_url, exc)
        return ""


def _download_image_bytes(url: str, referer: str = "", timeout: float = 15.0) -> str:
    """Download an image URL and return base64. Returns '' on failure."""
    if not url:
        return ""

    headers = {
        **_BROWSER_HEADERS,
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    }
    if referer:
        headers["Referer"] = referer

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True, headers=headers) as client:
            resp = client.get(url)
            resp.raise_for_status()

            if len(resp.content) < 1000:
                logger.warning("Image too small (%d bytes): %s", len(resp.content), url)
                return ""

            content_type = resp.headers.get("content-type", "")
            if "image" not in content_type and not url.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                logger.warning("Not an image (content-type: %s): %s", content_type, url)
                return ""

            return base64.b64encode(resp.content).decode("utf-8")
    except Exception as exc:
        logger.warning("Failed to download image %s: %s", url, exc)
        return ""


def _download_product_image(image_url: str, product_url: str = "", timeout: float = 15.0) -> str:
    """
    Download a product image with multiple fallback strategies:
      1. Try the direct image_url from web search
      2. If that fails, scrape the product page for og:image / real image URL
      3. Download that extracted URL instead
    Returns base64-encoded image or '' on failure.
    """
    if not image_url and not product_url:
        return ""

    # Determine referer from product URL domain
    referer = ""
    if product_url:
        from urllib.parse import urlparse
        parsed = urlparse(product_url)
        referer = f"{parsed.scheme}://{parsed.netloc}/"

    # Attempt 1: direct image URL
    if image_url:
        result = _download_image_bytes(image_url, referer=referer, timeout=timeout)
        if result:
            return result
        logger.info("Direct image URL failed, trying product page scrape...")

    # Attempt 2: scrape product page for the real image
    if product_url:
        scraped_img_url = _extract_image_from_product_page(product_url, timeout=timeout)
        if scraped_img_url and scraped_img_url != image_url:
            result = _download_image_bytes(scraped_img_url, referer=referer, timeout=timeout)
            if result:
                return result

    logger.warning("All image download strategies failed for: %s", image_url or product_url)
    return ""


def _product_to_matched(product: Product, slot: str, download_image: bool = True) -> MatchedProduct:
    """Convert a Product to a MatchedProduct, optionally downloading the image."""
    image_b64 = ""
    if download_image:
        image_b64 = _download_product_image(product.image_url, product.product_url)

    return MatchedProduct(
        product_id=product.id,
        name=product.name,
        category=str(product.category),
        price=product.price,
        currency=product.currency,
        image_url=product.image_url,
        image_base64=image_b64,
        product_url=product.product_url,
        store=product.store,
        slot=slot,
        description=product.description,
    )


# ---------------------------------------------------------------------------
# LangGraph node — searches the REAL web for products via OpenAI Responses API
# ---------------------------------------------------------------------------

def _web_search_product(client: "OpenAI", suggestion: Any, style: str) -> dict | None:
    """
    Use OpenAI Responses API with web_search_preview to find a REAL product
    on Romanian e-commerce sites. Returns parsed product dict or None.

    Has a 60-second timeout — if the API hangs, we skip this product.
    """
    prompt = f"""Search Romanian online furniture stores (emag.ro, jysk.ro, vivre.ro, ikea.ro, mobexpert.ro, somproduct.ro) for this product:

ITEM: {suggestion.item_type.upper()}
DESCRIPTION: {suggestion.description}
COLORS: {', '.join(suggestion.colors)}
STYLE: {suggestion.style_vibe}
DETAILS: {suggestion.specific_details}
ROMANIAN KEYWORDS: {', '.join(suggestion.search_keywords)}

Find ONE real product that matches this description. Focus on the product PAGE URL (not image URL).
Return ONLY valid JSON (no markdown, no extra text):
{{
  "name": "<exact product name from the store>",
  "description": "<brief description>",
  "price": <price in RON as number>,
  "currency": "RON",
  "image_url": "",
  "product_url": "<direct product page URL>",
  "store": "<store name>"
}}

IMPORTANT: Leave image_url empty — we will extract it from the product page.
Focus on returning a valid, real product_url that actually exists.
"""

    try:
        response = client.responses.create(
            model="gpt-4o",
            tools=[{"type": "web_search_preview"}],
            input=prompt,
            timeout=90,  # 90 second hard timeout
        )

        raw_text = response.output_text.strip()
        logger.info("Web search raw response for %s: %s", suggestion.item_type, raw_text[:300])

        # Strip markdown fences if present
        if raw_text.startswith("```"):
            lines = raw_text.split("```")
            raw_text = lines[1] if len(lines) > 1 else raw_text
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        # Try to extract JSON from the response if it contains extra text
        if not raw_text.startswith("{"):
            import re
            json_match = re.search(r'\{[^{}]*"name"[^{}]*"product_url"[^{}]*\}', raw_text, re.DOTALL)
            if json_match:
                raw_text = json_match.group(0)

        parsed = json.loads(raw_text)
        return parsed

    except Exception as exc:
        logger.warning("Web search failed for %s: %s", suggestion.item_type, exc)
        return None


MIN_PRODUCTS_WITH_IMAGE = 5
MAX_RETRIES_PER_SUGGESTION = 2


def _try_source_one(
    client: Any,
    suggestion: Any,
    style: str,
    job_id: Any,
) -> MatchedProduct | None:
    """
    Try to find one real product for a suggestion via web search.
    Downloads and validates the image. Returns MatchedProduct with image_base64
    populated, or None if everything failed.
    """
    from urllib.parse import urlparse

    product_data = _web_search_product(client, suggestion, style)
    if not product_data:
        return None

    matched = MatchedProduct(
        product_id=product_data.get("name", "unknown").replace(" ", "_")[:50],
        name=product_data.get("name", "Unknown Product"),
        category=suggestion.item_type,
        price=float(product_data.get("price", 0)),
        currency=product_data.get("currency", "RON"),
        image_url=product_data.get("image_url", ""),
        image_base64="",
        product_url=product_data.get("product_url", ""),
        store=product_data.get("store", ""),
        slot=suggestion.placement,
        description=suggestion.description,
    )

    # Scrape product page for og:image (most reliable)
    if matched.product_url:
        scraped_img = _extract_image_from_product_page(
            matched.product_url,
            expected_name=matched.name,
        )
        if scraped_img:
            matched.image_url = scraped_img
            parsed_url = urlparse(matched.product_url)
            referer = f"{parsed_url.scheme}://{parsed_url.netloc}/"
            matched.image_base64 = _download_image_bytes(scraped_img, referer=referer)

    # Fallback: try the original image_url from web search
    if not matched.image_base64 and matched.image_url:
        matched.image_base64 = _download_image_bytes(matched.image_url)

    return matched


def market_sourcing_node(state: GraphState) -> GraphState:
    """
    For each design suggestion, use OpenAI Responses API with web_search_preview
    to find REAL products on Romanian e-commerce sites. Downloads product images.

    Keeps retrying until we have at least MIN_PRODUCTS_WITH_IMAGE (5) products
    with successfully downloaded images, or we exhaust all suggestions + retries.
    """
    logger.info("Market Agent — Web Search Sourcing starting (job=%s)", state.job_id)
    state.status = JobStatus.SOURCING

    from openai import OpenAI

    sourced: list[MatchedProduct] = []

    if not state.design_plan.suggestions:
        logger.info("No design suggestions — skipping sourcing (job=%s)", state.job_id)
        state.sourced_products = sourced
        state.alternative_products = []
        return state

    client = OpenAI(timeout=90.0)
    style = state.desired_style.value

    products_with_image = 0

    for idx, suggestion in enumerate(state.design_plan.suggestions, start=1):
        # Stop once we have enough products with images
        if products_with_image >= MIN_PRODUCTS_WITH_IMAGE:
            logger.info(
                "Market Agent — Got %d products with images, stopping (job=%s)",
                products_with_image, state.job_id,
            )
            break

        logger.info(
            "Market Agent — [%d/%d] Web searching for: %s (%s) (job=%s)",
            idx, len(state.design_plan.suggestions),
            suggestion.item_type, suggestion.placement, state.job_id,
        )

        # Try up to MAX_RETRIES_PER_SUGGESTION times for each suggestion
        matched = None
        for attempt in range(1, MAX_RETRIES_PER_SUGGESTION + 1):
            matched = _try_source_one(client, suggestion, style, state.job_id)

            if matched and matched.image_base64:
                logger.info(
                    "Market Agent — Got image for '%s' from %s (attempt %d)",
                    matched.name, matched.store, attempt,
                )
                break
            elif matched:
                logger.warning(
                    "Market Agent — No image for '%s' (attempt %d/%d), retrying...",
                    matched.name, attempt, MAX_RETRIES_PER_SUGGESTION,
                )
                matched = None  # discard — we want products WITH images
            else:
                logger.warning(
                    "Market Agent — Search returned nothing for %s (attempt %d/%d)",
                    suggestion.item_type, attempt, MAX_RETRIES_PER_SUGGESTION,
                )

        if matched and matched.image_base64:
            sourced.append(matched)
            products_with_image += 1
            logger.info(
                "Market Agent — Found [%d/%d]: '%s' — %.0f %s from %s | URL: %s",
                products_with_image, MIN_PRODUCTS_WITH_IMAGE,
                matched.name, matched.price, matched.currency,
                matched.store, matched.product_url,
            )
        else:
            logger.warning(
                "Market Agent — Giving up on %s after %d attempts (job=%s)",
                suggestion.item_type, MAX_RETRIES_PER_SUGGESTION, state.job_id,
            )

    state.sourced_products = sourced
    state.alternative_products = []

    total = sum(p.price for p in sourced)
    logger.info(
        "Market Agent done — %d products with images sourced (job=%s), total=%.2f RON",
        len(sourced), state.job_id, total,
    )
    return state
