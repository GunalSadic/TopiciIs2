"use client";

import { useState } from "react";
import type { DesignResponse, MatchedProduct } from "@/types";
import DesignCart from "./DesignCart";

interface Props {
  result: DesignResponse;
  onReset: () => void;
  onSwapProduct: (slot: string, newProductId: string) => void;
  isReplacing: boolean;
}

function ProductMiniCard({ product }: { product: MatchedProduct }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand-lighter bg-brand-bg p-3">
      <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-white border border-brand-lighter">
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
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-brand-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-brand-dark truncate">{product.name}</p>
        <p className="text-xs text-brand-mid">{product.store}</p>
        <p className="text-xs font-bold text-brand-dark mt-0.5">
          {product.price > 0
            ? `${product.price.toLocaleString("ro-RO")} ${product.currency}`
            : "Pret nedefinit"}
        </p>
        {product.product_url && (
          <a
            href={product.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-brand-mid hover:text-brand-dark underline"
          >
            Deschide →
          </a>
        )}
      </div>
    </div>
  );
}

export default function ResultCard({ result, onReset, onSwapProduct, isReplacing }: Props) {
  const { design_proposal, room_analysis, sourced_products, alternative_products } = result;

  const intermediateImages = design_proposal.intermediate_images ?? [];
  const intermediateProducts = design_proposal.intermediate_products ?? [];
  const hasIntermediates = intermediateImages.length > 0;

  const [currentIdx, setCurrentIdx] = useState(
    hasIntermediates ? intermediateImages.length - 1 : 0
  );

  const displayImageSrc = hasIntermediates
    ? `data:image/png;base64,${intermediateImages[currentIdx]}`
    : design_proposal.generated_image_url || design_proposal.generated_image_b64
    ? `data:image/png;base64,${design_proposal.generated_image_b64}`
    : "";

  // Find the product that was placed in this step
  const currentStepProductName = intermediateProducts[currentIdx];
  const currentStepProduct = sourced_products.find(
    (p) =>
      p.name === currentStepProductName ||
      p.slot === currentStepProductName ||
      p.name.toLowerCase().includes(currentStepProductName?.toLowerCase() ?? "__")
  );

  const allProducts = sourced_products.length > 0
    ? sourced_products
    : design_proposal.matched_products ?? [];

  return (
    <div className="space-y-6">
      {/* ── Iterative step viewer ── */}
      {hasIntermediates && (
        <div className="space-y-3">
          {/* Step label */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-brand-dark">
              Pas {currentIdx + 1} din {intermediateImages.length}
            </span>
            {currentStepProductName && (
              <span className="text-brand-mid truncate max-w-[200px]">
                + {currentStepProductName}
              </span>
            )}
          </div>

          {/* Main room image */}
          <div className="relative overflow-hidden rounded-2xl shadow-xl border border-brand-lighter">
            <img
              src={displayImageSrc}
              alt={`Pas ${currentIdx + 1}: ${currentStepProductName ?? ""}`}
              className="w-full object-cover"
            />
            {/* Step counter overlay */}
            <div className="absolute top-3 left-3 bg-brand-deep/70 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              Pas {currentIdx + 1}/{intermediateImages.length}
            </div>
          </div>

          {/* Product that was added in this step */}
          {currentStepProduct && (
            <div className="flex items-center gap-1 text-xs text-brand-mid mb-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Produs adaugat in acest pas:
            </div>
          )}
          {currentStepProduct && <ProductMiniCard product={currentStepProduct} />}

          {/* Thumbnail carousel */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {intermediateImages.map((img, idx) => {
              const prod = sourced_products.find(
                (p) =>
                  p.name === intermediateProducts[idx] ||
                  p.slot === intermediateProducts[idx]
              );
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIdx(idx)}
                  className={`flex-shrink-0 relative rounded-xl overflow-hidden border-2 transition-all ${
                    idx === currentIdx
                      ? "border-brand-dark ring-2 ring-brand-dark/20 w-24 h-20"
                      : "border-brand-lighter hover:border-brand-light w-16 h-14 opacity-70 hover:opacity-100"
                  }`}
                  title={intermediateProducts[idx]}
                >
                  <img
                    src={`data:image/png;base64,${img}`}
                    alt={`Pas ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {/* Product thumbnail overlay */}
                  {prod?.image_base64 && (
                    <div className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded border border-white overflow-hidden shadow">
                      <img
                        src={`data:image/jpeg;base64,${prod.image_base64}`}
                        alt={prod.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
              disabled={currentIdx === 0}
              className="flex-1 rounded-xl border border-brand-lighter text-brand-dark py-2.5 text-sm font-semibold disabled:opacity-40 hover:bg-brand-bg transition-colors"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setCurrentIdx(Math.min(intermediateImages.length - 1, currentIdx + 1))}
              disabled={currentIdx === intermediateImages.length - 1}
              className="flex-1 rounded-xl border border-brand-lighter text-brand-dark py-2.5 text-sm font-semibold disabled:opacity-40 hover:bg-brand-bg transition-colors"
            >
              Urmator →
            </button>
          </div>
        </div>
      )}

      {/* Fallback: single generated image */}
      {!hasIntermediates && displayImageSrc && (
        <div className="overflow-hidden rounded-2xl shadow-xl border border-brand-lighter">
          <img
            src={displayImageSrc}
            alt="Camera redesignata cu produse reale"
            className="w-full object-cover"
          />
        </div>
      )}

      {/* Design rationale */}
      {design_proposal.design_rationale && (
        <div className="rounded-xl bg-brand-bg border border-brand-lighter p-5 space-y-1">
          <h3 className="text-xs font-bold text-brand-mid uppercase tracking-widest">
            Rationale design
          </h3>
          <p className="text-brand-dark text-sm leading-relaxed">
            {design_proposal.design_rationale}
          </p>
        </div>
      )}

      {/* Design Cart */}
      <div className="rounded-xl bg-white border border-brand-lighter p-5">
        <DesignCart
          matchedProducts={allProducts}
          suggestions={alternative_products ?? design_proposal.suggestions ?? []}
          totalPrice={design_proposal.total_price ?? 0}
          onSwapProduct={onSwapProduct}
          isReplacing={isReplacing}
        />
      </div>

      {/* Room summary */}
      <div className="rounded-xl bg-brand-bg border border-brand-lighter p-4 space-y-1">
        <h3 className="text-xs font-bold text-brand-mid uppercase tracking-widest">
          Analiza camerei
        </h3>
        <p className="text-sm text-brand-dark leading-relaxed">{room_analysis.raw_description}</p>
        <p className="text-xs text-brand-mid mt-1">
          Iluminare: {room_analysis.lighting} · Tip: {room_analysis.room_type}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {displayImageSrc && (
          <a
            href={displayImageSrc}
            download="auradesign-result.png"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-xl bg-brand-dark text-white text-sm font-semibold py-3 text-center hover:bg-[#55536A] transition-colors shadow-md shadow-brand-dark/10"
          >
            Descarca imaginea
          </a>
        )}
        <button
          onClick={onReset}
          className="flex-1 rounded-xl border border-brand-lighter text-brand-dark text-sm font-semibold py-3 hover:bg-brand-bg transition-colors"
        >
          Incepe din nou
        </button>
      </div>
    </div>
  );
}
