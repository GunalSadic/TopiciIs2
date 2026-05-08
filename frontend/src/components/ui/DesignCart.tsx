"use client";

import type { MatchedProduct } from "@/types";

interface Props {
  matchedProducts: MatchedProduct[];
  suggestions: MatchedProduct[];
  totalPrice: number;
  onSwapProduct: (slot: string, newProductId: string) => void;
  isReplacing: boolean;
}

export default function DesignCart({
  matchedProducts,
  suggestions,
  totalPrice,
  onSwapProduct,
  isReplacing,
}: Props) {
  // Group suggestions by slot
  const suggestionsBySlot: Record<string, MatchedProduct[]> = {};
  for (const s of suggestions) {
    if (!suggestionsBySlot[s.slot]) suggestionsBySlot[s.slot] = [];
    suggestionsBySlot[s.slot].push(s);
  }

  return (
    <div className="space-y-6">
      {/* Design Cart Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-800">
          Cosul de Design
        </h3>
        <span className="text-sm font-bold text-violet-600 bg-violet-50 px-3 py-1 rounded-full">
          Total: {totalPrice.toLocaleString("ro-RO")} RON
        </span>
      </div>

      {/* Matched Products */}
      {matchedProducts.length > 0 ? (
        <div className="space-y-3">
          {matchedProducts.map((product) => (
            <div
              key={product.product_id}
              className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3"
            >
              <div className="w-2 h-2 mt-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-800 truncate">
                  {product.name}
                </p>
                <p className="text-xs text-zinc-500">
                  {product.store} · {product.category}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-emerald-700">
                    {product.price.toLocaleString("ro-RO")} {product.currency}
                  </span>
                  <a
                    href={product.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-violet-600 hover:text-violet-800 underline"
                  >
                    Cumpara
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-400 italic">
          Nu s-au gasit produse potrivite in catalog.
        </p>
      )}

      {/* Alternative Suggestions */}
      {Object.keys(suggestionsBySlot).length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-zinc-600 uppercase tracking-wide">
            Alte produse care s-ar potrivi
          </h4>
          {Object.entries(suggestionsBySlot).map(([slot, products]) => (
            <div key={slot} className="space-y-2">
              <p className="text-xs font-medium text-zinc-500 capitalize">
                {slot}
              </p>
              {products.map((product) => (
                <div
                  key={product.product_id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2.5 hover:border-violet-300 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-700 truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {product.store} · {product.price.toLocaleString("ro-RO")} RON
                    </p>
                  </div>
                  <button
                    onClick={() => onSwapProduct(slot, product.product_id)}
                    disabled={isReplacing}
                    className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
