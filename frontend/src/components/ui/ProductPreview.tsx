"use client";

import type { SourcingResponse } from "@/types";

interface Props {
  sourcing: SourcingResponse;
  onConfirm: () => void;
  onBack: () => void;
}

export default function ProductPreview({ sourcing, onConfirm, onBack }: Props) {
  const { sourced_products, design_plan } = sourcing;
  const totalPrice = sourced_products.reduce((sum, p) => sum + p.price, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-violet-50 border border-violet-100 p-4 space-y-1">
        <h3 className="text-sm font-semibold text-violet-700 uppercase tracking-wide">
          Design Vision
        </h3>
        <p className="text-sm text-zinc-700">{design_plan.overall_vision}</p>
      </div>

      {/* Product cards */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-zinc-800">
          Produse gasite pe site-urile romanesti ({sourced_products.length})
        </h3>
        <p className="text-xs text-zinc-400">
          Acestea vor fi integrate in imaginea ta. Verifica linkurile si preturile inainte de a continua.
        </p>

        {sourced_products.map((product, idx) => (
          <div
            key={idx}
            className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            {/* Product image */}
            <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200">
              {product.image_base64 ? (
                <img
                  src={`data:image/jpeg;base64,${product.image_base64}`}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xs">
                  No image
                </div>
              )}
            </div>

            {/* Product info */}
            <div className="flex-1 min-w-0 space-y-1">
              <h4 className="text-sm font-semibold text-zinc-800 truncate">
                {product.name}
              </h4>
              <p className="text-xs text-zinc-500 truncate">
                {product.description}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-violet-700">
                  {product.price.toLocaleString("ro-RO")} {product.currency}
                </span>
                <span className="text-zinc-400">·</span>
                <span className="text-zinc-500">{product.store}</span>
              </div>
              <p className="text-xs text-zinc-400">
                Plasare: {product.slot}
              </p>
              {product.product_url && (
                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-violet-600 hover:text-violet-800 underline"
                >
                  Vezi pe {product.store} →
                </a>
              )}
            </div>

            {/* Status indicator */}
            <div className="flex-shrink-0 flex items-start">
              {product.image_base64 ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 rounded-full px-2 py-0.5">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Imagine OK
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                  Text only
                </span>
              )}
            </div>
          </div>
        ))}

        {sourced_products.length === 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-amber-700">
              Nu s-au gasit produse pe site-urile romanesti. Renderul va folosi doar descrieri text.
            </p>
          </div>
        )}
      </div>

      {/* Total + Actions */}
      <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">Total estimat</p>
          <p className="text-lg font-bold text-zinc-900">
            {totalPrice.toLocaleString("ro-RO")} RON
          </p>
        </div>
        <div className="text-right text-xs text-zinc-400">
          {sourced_products.filter(p => p.image_base64).length} / {sourced_products.length} imagini descarcate
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border border-zinc-300 text-zinc-700 text-sm font-semibold py-3 hover:bg-zinc-50 transition-colors"
        >
          ← Inapoi
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-xl bg-violet-600 text-white text-sm font-semibold py-3 hover:bg-violet-700 active:scale-95 transition-all"
        >
          Confirma si Genereaza Design →
        </button>
      </div>
    </div>
  );
}
