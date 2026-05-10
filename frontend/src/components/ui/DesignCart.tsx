"use client";

import type { MatchedProduct } from "@/types";

interface Props {
  matchedProducts: MatchedProduct[];
  suggestions: MatchedProduct[];
  totalPrice: number;
  onSwapProduct: (slot: string, newProductId: string) => void;
  isReplacing: boolean;
}

function ProductThumb({ product }: { product: MatchedProduct }) {
  if (product.image_base64) {
    return (
      <img
        src={`data:image/jpeg;base64,${product.image_base64}`}
        alt={product.name}
        className="w-full h-full object-cover"
      />
    );
  }
  if (product.image_url) {
    return (
      <img
        src={product.image_url}
        alt={product.name}
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg className="w-4 h-4 text-brand-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    </div>
  );
}

export default function DesignCart({
  matchedProducts,
  suggestions,
  totalPrice,
  onSwapProduct,
  isReplacing,
}: Props) {
  const suggestionsBySlot: Record<string, MatchedProduct[]> = {};
  for (const s of suggestions) {
    if (!suggestionsBySlot[s.slot]) suggestionsBySlot[s.slot] = [];
    suggestionsBySlot[s.slot].push(s);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-brand-dark">Produse integrate</h3>
        <span className="text-sm font-bold text-brand-dark bg-brand-lighter border border-brand-light px-3 py-1 rounded-full">
          {totalPrice.toLocaleString("ro-RO")} RON
        </span>
      </div>

      {/* Matched Products — with thumbnails */}
      {matchedProducts.length > 0 ? (
        <div className="space-y-2">
          {matchedProducts.map((product) => (
            <div
              key={product.product_id}
              className="flex items-center gap-3 rounded-xl border border-brand-lighter bg-brand-bg p-3"
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-white border border-brand-lighter">
                <ProductThumb product={product} />
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-brand-dark truncate">{product.name}</p>
                <p className="text-xs text-brand-mid">
                  {product.store} · <span className="capitalize">{product.category}</span>
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-brand-dark">
                    {product.price.toLocaleString("ro-RO")} {product.currency}
                  </span>
                  {product.product_url && (
                    <a
                      href={product.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-mid hover:text-brand-dark underline"
                    >
                      Cumpara →
                    </a>
                  )}
                </div>
              </div>
              {/* Slot tag */}
              <span className="flex-shrink-0 text-xs text-brand-mid bg-white border border-brand-lighter rounded-full px-2 py-0.5 capitalize">
                {product.slot}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-brand-mid italic">
          Nu s-au gasit produse potrivite in catalog.
        </p>
      )}

      {/* Alternative suggestions */}
      {Object.keys(suggestionsBySlot).length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-brand-mid uppercase tracking-widest">
            Alternative disponibile
          </h4>
          {Object.entries(suggestionsBySlot).map(([slot, products]) => (
            <div key={slot} className="space-y-2">
              <p className="text-xs font-semibold text-brand-dark capitalize">{slot}</p>
              {products.map((product) => (
                <div
                  key={product.product_id}
                  className="flex items-center gap-3 rounded-lg border border-brand-lighter bg-white p-2.5 hover:border-brand-light transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-brand-bg border border-brand-lighter">
                    <ProductThumb product={product} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-brand-dark truncate">{product.name}</p>
                    <p className="text-xs text-brand-mid">
                      {product.store} · {product.price.toLocaleString("ro-RO")} RON
                    </p>
                  </div>
                  <button
                    onClick={() => onSwapProduct(slot, product.product_id)}
                    disabled={isReplacing}
                    className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-lighter text-brand-dark hover:bg-brand-light hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isReplacing ? "..." : "Inlocuieste"}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
