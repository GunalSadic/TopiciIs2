"use client";

import { useState } from "react";
import type { DesignResponse } from "@/types";
import DesignCart from "./DesignCart";

interface Props {
  result: DesignResponse;
  onReset: () => void;
  onSwapProduct: (slot: string, newProductId: string) => void;
  isReplacing: boolean;
}

export default function ResultCard({ result, onReset, onSwapProduct, isReplacing }: Props) {
  const { design_proposal, room_analysis, sourced_products, alternative_products } = result;
  const [currentImageIndex, setCurrentImageIndex] = useState(
    design_proposal.intermediate_images?.length ? design_proposal.intermediate_images.length - 1 : 0
  );

  const intermediateImages = design_proposal.intermediate_images || [];
  const intermediateProducts = design_proposal.intermediate_products || [];
  const hasIntermediates = intermediateImages.length > 0;

  const displayImageUrl = hasIntermediates
    ? `data:image/png;base64,${intermediateImages[currentImageIndex]}`
    : design_proposal.generated_image_url;

  return (
    <div className="space-y-6">
      {/* Iterative process viewer */}
      {hasIntermediates && (
        <div className="space-y-3">
          {/* Image display */}
          <div className="overflow-hidden rounded-2xl shadow-xl">
            <img
              src={displayImageUrl}
              alt={`Design iteration: ${intermediateProducts[currentImageIndex] || "step"}`}
              className="w-full object-cover"
            />
          </div>

          {/* Step indicator and navigation */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold text-zinc-600">
                Step {currentImageIndex + 1} of {intermediateImages.length}
              </p>
              <p className="text-xs text-zinc-500">
                {intermediateProducts[currentImageIndex]}
              </p>
            </div>

            {/* Thumbnail carousel */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {intermediateImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === currentImageIndex
                      ? "border-violet-600 ring-2 ring-violet-300"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                  title={intermediateProducts[idx]}
                >
                  <img
                    src={`data:image/png;base64,${img}`}
                    alt={`Step ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
                disabled={currentImageIndex === 0}
                className="flex-1 rounded-lg bg-zinc-100 text-zinc-700 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-zinc-200 transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={() => setCurrentImageIndex(Math.min(intermediateImages.length - 1, currentImageIndex + 1))}
                disabled={currentImageIndex === intermediateImages.length - 1}
                className="flex-1 rounded-lg bg-zinc-100 text-zinc-700 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-zinc-200 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated render (fallback if no intermediates) */}
      {!hasIntermediates && (
        <div className="overflow-hidden rounded-2xl shadow-xl">
          <img
            src={design_proposal.generated_image_url}
            alt="AI-generated room redesign with real products"
            className="w-full object-cover"
          />
        </div>
      )}

      {/* Design rationale */}
      <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-5 space-y-1">
        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
          Design rationale
        </h3>
        <p className="text-zinc-800 leading-relaxed">
          {design_proposal.design_rationale}
        </p>
      </div>

      {/* Design Cart — Real Products */}
      <div className="rounded-xl bg-white border border-zinc-200 p-5">
        <DesignCart
          matchedProducts={sourced_products ?? design_proposal.matched_products ?? []}
          suggestions={alternative_products ?? design_proposal.suggestions ?? []}
          totalPrice={design_proposal.total_price ?? 0}
          onSwapProduct={onSwapProduct}
          isReplacing={isReplacing}
        />
      </div>

      {/* Room summary */}
      <div className="rounded-xl bg-violet-50 border border-violet-100 p-5 space-y-2">
        <h3 className="text-sm font-semibold text-violet-600 uppercase tracking-wide">
          Room analysis
        </h3>
        <p className="text-sm text-zinc-600">{room_analysis.raw_description}</p>
        <p className="text-xs text-zinc-400">
          Lighting: {room_analysis.lighting} · Type: {room_analysis.room_type}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href={design_proposal.generated_image_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-xl bg-violet-600 text-white text-sm font-semibold py-3 text-center hover:bg-violet-700 transition-colors"
        >
          Open full image
        </a>
        <button
          onClick={onReset}
          className="flex-1 rounded-xl border border-zinc-300 text-zinc-700 text-sm font-semibold py-3 hover:bg-zinc-50 transition-colors"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
