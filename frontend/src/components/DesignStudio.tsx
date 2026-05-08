"use client";

import { useState } from "react";
import type { DesignStyle } from "@/types";
import { useDesignFlow } from "@/hooks/useDesignFlow";
import ImageDropzone from "@/components/ui/ImageDropzone";
import FurnitureChecklist from "@/components/ui/FurnitureChecklist";
import StyleSelector from "@/components/ui/StyleSelector";
import ProductPreview from "@/components/ui/ProductPreview";
import ResultCard from "@/components/ui/ResultCard";
import Spinner from "@/components/ui/Spinner";

export default function DesignStudio() {
  const {
    step,
    error,
    analysis,
    sourcing,
    result,
    keepList,
    handleUpload,
    toggleKeep,
    handleSourceProducts,
    handleConfirmAndRender,
    handleBackToSelecting,
    handleSmartReplace,
    reset,
  } = useDesignFlow();

  const [style, setStyle] = useState<DesignStyle>("Modern");
  const [notes, setNotes] = useState("");
  const [budget, setBudget] = useState<string>("");

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
          AuraDesign <span className="text-violet-600">RO</span>
        </h1>
        <p className="text-zinc-500 text-sm">
          Vizualizeaza Viitorul. Cumpara Local. Traieste Frumos.
        </p>
        <p className="text-zinc-400 text-xs">
          Upload your room · choose what to keep · pick a style · preview real products · get a render
        </p>
      </div>

      {/* Step 1 — Upload */}
      {(step === "idle" || step === "uploading") && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-700">
            1 · Upload your room photo
          </h2>
          <ImageDropzone
            onFile={handleUpload}
            disabled={step === "uploading"}
          />
          {step === "uploading" && (
            <Spinner label="Analyzing your room with GPT-4o Vision..." />
          )}
        </section>
      )}

      {/* Step 2 — Select furniture + style */}
      {step === "selecting" && analysis && (
        <section className="space-y-6">
          <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4">
            <p className="text-sm text-zinc-600">
              <span className="font-semibold capitalize">
                {analysis.room_analysis.room_type}
              </span>{" "}
              · {analysis.room_analysis.raw_description}
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-700">
              2 · Choose furniture to keep
            </h2>
            <p className="text-xs text-zinc-400">
              Unchecked items will be replaced with real products from Romanian stores.
            </p>
            <FurnitureChecklist
              furniture={analysis.room_analysis.detected_furniture}
              keepList={keepList}
              onToggle={toggleKeep}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-700">
              3 · Pick a design style
            </h2>
            <StyleSelector selected={style} onChange={setStyle} />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-700">
              4 · Budget limit <span className="text-zinc-400 font-normal">(optional, RON)</span>
            </h2>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full rounded-xl border border-zinc-300 p-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-700">
              5 · Any extra notes? <span className="text-zinc-400 font-normal">(optional)</span>
            </h2>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. I need a reading nook, prefer dark walls, have a large dog..."
              className="w-full rounded-xl border border-zinc-300 p-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <button
            onClick={() =>
              handleSourceProducts(
                style,
                notes,
                budget ? parseFloat(budget) : undefined
              )
            }
            className="w-full rounded-xl bg-violet-600 text-white font-semibold py-4 text-base hover:bg-violet-700 active:scale-95 transition-all"
          >
            Cauta Produse Reale
          </button>
        </section>
      )}

      {/* Step 3 — Sourcing (loading) */}
      {step === "sourcing" && (
        <Spinner label="Cautam produse reale pe site-urile romanesti (emag, jysk, vivre)... (30-90 sec)" />
      )}

      {/* Step 4 — Product Preview (confirmation before render) */}
      {step === "previewing" && sourcing && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-700">
            Produse gasite — verifica inainte de a genera designul
          </h2>
          <ProductPreview
            sourcing={sourcing}
            onConfirm={handleConfirmAndRender}
            onBack={handleBackToSelecting}
          />
        </section>
      )}

      {/* Step 5 — Rendering (loading) */}
      {step === "rendering" && (
        <Spinner label="Integram produsele in camera ta cu AI... (30-60 sec per produs)" />
      )}

      {/* Step 5b — Smart Replace in progress */}
      {step === "replacing" && (
        <div className="space-y-4">
          {result && (
            <div className="overflow-hidden rounded-2xl shadow-xl opacity-50">
              <img
                src={result.design_proposal.generated_image_url}
                alt="Current design"
                className="w-full object-cover"
              />
            </div>
          )}
          <Spinner label="Swapping product and re-rendering... (30-60 sec)" />
        </div>
      )}

      {/* Step 6 — Done */}
      {step === "done" && result && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-700">
            Your redesigned room — with real products
          </h2>
          <ResultCard
            result={result}
            onReset={reset}
            onSwapProduct={handleSmartReplace}
            isReplacing={false}
          />
        </section>
      )}

      {/* Error */}
      {step === "error" && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-5 space-y-3">
          <p className="text-sm font-semibold text-red-700">Something went wrong</p>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={reset}
            className="text-sm underline text-red-500 hover:text-red-700"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
