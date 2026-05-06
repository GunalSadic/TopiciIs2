"""
Agent 2.5 — Market Agent
Manages product catalog and search functionality.
Simulates a database of real products from Romanian e-commerce platforms.
Used to find real furniture pieces that match design requirements.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from app.models.schemas import Product, ProductCategory, ProductSearchRequest, ProductSearchResponse

logger = logging.getLogger(__name__)


class ProductService:
    """
    In-memory product database service.
    Loads product catalog from JSON and provides search/filter capabilities.
    """

    def __init__(self, products_json_path: str | None = None):
        """
        Initialize ProductService with products from JSON file.
        
        Args:
            products_json_path: Path to products.json. If None, uses default location.
        """
        self.products: dict[str, Product] = {}
        self.categories: dict[str, list[str]] = {}  # category -> [product_ids]
        self.styles: dict[str, list[str]] = {}      # style -> [product_ids]
        
        # Load products from JSON
        if products_json_path is None:
            # Default: look in app/data/products.json
            products_json_path = Path(__file__).parent.parent / "data" / "products.json"
        
        self._load_products(products_json_path)
        logger.info(f"ProductService initialized with {len(self.products)} products")

    def _load_products(self, json_path: str | Path) -> None:
        """Load products from JSON file and build indexes."""
        json_path = Path(json_path)
        
        if not json_path.exists():
            logger.warning(f"Products file not found: {json_path}. Starting with empty catalog.")
            return
        
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            for product_data in data.get("products", []):
                product = Product(**product_data)
                self.products[product.id] = product
                
                # Index by category
                category = str(product.category)
                if category not in self.categories:
                    self.categories[category] = []
                self.categories[category].append(product.id)
                
                # Index by styles
                for style in product.styles:
                    if style not in self.styles:
                        self.styles[style] = []
                    self.styles[style].append(product.id)
            
            logger.info(f"Loaded {len(self.products)} products from {json_path}")
            logger.info(f"Categories: {list(self.categories.keys())}")
            logger.info(f"Styles: {list(self.styles.keys())}")
        
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in products file: {e}")
        except Exception as e:
            logger.error(f"Error loading products: {e}")

    def get_product(self, product_id: str) -> Product | None:
        """Get a single product by ID."""
        return self.products.get(product_id)

    def search(self, request: ProductSearchRequest) -> ProductSearchResponse:
        """
        Search products by category, style, price, and search term.
        
        Args:
            request: ProductSearchRequest with filters
        
        Returns:
            ProductSearchResponse with matching products
        """
        results: list[Product] = []
        
        # Start with all products
        candidates = set(self.products.keys())
        
        # Filter by category
        if request.category:
            category_ids = self.categories.get(request.category.lower(), [])
            candidates &= set(category_ids)
        
        # Filter by style
        if request.style:
            style_ids = self.styles.get(request.style, [])
            candidates &= set(style_ids)
        
        # Filter by max price
        if request.max_price is not None:
            candidates = {
                pid for pid in candidates
                if self.products[pid].price <= request.max_price
            }
        
        # Filter by search term (name, description)
        if request.search_term:
            search_term = request.search_term.lower()
            candidates = {
                pid for pid in candidates
                if search_term in self.products[pid].name.lower()
                or search_term in self.products[pid].description.lower()
            }
        
        # Build result list
        for pid in sorted(candidates):
            results.append(self.products[pid])
        
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
        """Get all products in a category."""
        product_ids = self.categories.get(category.lower(), [])
        return [self.products[pid] for pid in product_ids]

    def search_by_style(self, style: str) -> list[Product]:
        """Get all products with a specific style."""
        product_ids = self.styles.get(style, [])
        return [self.products[pid] for pid in product_ids]

    def search_by_price_range(self, min_price: float = 0, max_price: float = float("inf")) -> list[Product]:
        """Get all products within a price range."""
        return [
            p for p in self.products.values()
            if min_price <= p.price <= max_price
        ]

    def get_recommendations(
        self,
        room_analysis: dict[str, Any],
        style: str,
        excluded_ids: list[str] | None = None
    ) -> list[Product]:
        """
        Get product recommendations based on room analysis and design style.
        
        Args:
            room_analysis: Room analysis from Vision Analyzer
            style: Desired design style (Modern, Minimalist, etc.)
            excluded_ids: Product IDs to exclude from results
        
        Returns:
            List of recommended products
        """
        excluded = set(excluded_ids or [])
        
        # Get all products matching the style
        style_products = [
            self.products[pid]
            for pid in self.styles.get(style, [])
            if pid not in excluded
        ]
        
        # Sort by rating (descending)
        style_products.sort(key=lambda p: p.rating, reverse=True)
        
        return style_products[:10]  # Return top 10

    def get_all_categories(self) -> list[str]:
        """Get list of all available categories."""
        return sorted(self.categories.keys())

    def get_all_styles(self) -> list[str]:
        """Get list of all available styles."""
        return sorted(self.styles.keys())

    def get_stats(self) -> dict[str, Any]:
        """Get statistics about the product catalog."""
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


# Singleton instance — created once at startup
_product_service: ProductService | None = None


def get_product_service() -> ProductService:
    """Get or create the ProductService singleton."""
    global _product_service
    if _product_service is None:
        _product_service = ProductService()
    return _product_service


def initialize_product_service(json_path: str | None = None) -> ProductService:
    """Initialize the ProductService with optional custom JSON path."""
    global _product_service
    _product_service = ProductService(json_path)
    return _product_service
