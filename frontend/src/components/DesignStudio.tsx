"use client";

import Link from "next/link";
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
    imagePreview,
    handleUpload,
    toggleKeep,
    handleSourceProducts,
    handleConfirmAndRender,
    handleBackToSelecting,
    handleSmartReplace,
    handleAddCustomProduct,
    handleRemoveProduct,
    handleFindMoreProducts,
    reset,
  } = useDesignFlow();

  const [style, setStyle] = useState<DesignStyle>("Modern");
  const [notes, setNotes] = useState("");
  const [budget, setBudget] = useState<string>("");

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Top bar */}
      <header className="border-b border-brand-lighter bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-base tracking-tight">
            <span className="text-brand-dark">Aura</span>
            <span className="text-brand-mid">Design</span>
            <span className="ml-1.5 text-brand-light text-xs font-normal">RO</span>
          </Link>
          <p className="text-brand-mid text-xs hidden sm:block">
            Vizualizeaza · Cumpara Local · Traieste Frumos
          </p>
          {step !== "idle" && step !== "uploading" && (
            <button
              onClick={reset}
              className="text-xs text-brand-mid hover:text-brand-dark transition-colors border border-brand-lighter rounded-lg px-3 py-1.5 hover:border-brand-light bg-white"
            >
              Incepe din nou
            </button>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Step 1 — Upload */}
        {(step === "idle" || step === "uploading") && (
          <section className="space-y-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-dark text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h2 className="text-base font-semibold text-brand-dark">
                  Incarca fotografia camerei
                </h2>
              </div>
              <p className="text-xs text-brand-mid pl-8">JPEG, PNG sau WebP · max 10 MB</p>
            </div>
            <ImageDropzone onFile={handleUpload} disabled={step === "uploading"} />
            {step === "uploading" && (
              <Spinner label="Analizam camera cu GPT-4o Vision..." />
            )}
          </section>
        )}

        {/* Step 2 — Select furniture + style */}
        {step === "selecting" && analysis && (
          <section className="space-y-7">
            {/* Room photo stays visible */}
            {imagePreview && (
              <div className="rounded-2xl overflow-hidden border border-brand-lighter shadow-sm">
                <img
                  src={imagePreview}
                  alt="Camera ta"
                  className="w-full object-cover max-h-72"
                />
                <div className="bg-white border-t border-brand-lighter px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-brand-mid">
                    <span className="font-semibold capitalize text-brand-dark">
                      {analysis.room_analysis.room_type}
                    </span>
                    {analysis.room_analysis.raw_description
                      ? ` · ${analysis.room_analysis.raw_description.slice(0, 90)}…`
                      : ""}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-emerald-600 flex-shrink-0">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Analizat
                  </span>
                </div>
              </div>
            )}

            {/* Furniture checklist */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-dark text-white text-xs font-bold flex items-center justify-center">2</span>
                <h2 className="text-base font-semibold text-brand-dark">Ce mobila pastrezi?</h2>
              </div>
              <p className="text-xs text-brand-mid pl-8">
                Elementele nebifate vor fi inlocuite cu produse reale.
              </p>
              <FurnitureChecklist
                furniture={analysis.room_analysis.detected_furniture}
                keepList={keepList}
                onToggle={toggleKeep}
              />
            </div>

            {/* Style selector */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-dark text-white text-xs font-bold flex items-center justify-center">3</span>
                <h2 className="text-base font-semibold text-brand-dark">Stil de design</h2>
              </div>
              <StyleSelector selected={style} onChange={setStyle} />
            </div>

            {/* Budget */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-lighter text-brand-mid text-xs font-bold flex items-center justify-center border border-brand-light">4</span>
                <h2 className="text-base font-semibold text-brand-dark">
                  Buget maxim{" "}
                  <span className="text-brand-mid font-normal text-sm">(optional, RON)</span>
                </h2>
              </div>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="ex. 5000"
                className="w-full rounded-xl border border-brand-lighter bg-white p-3 text-sm text-brand-dark placeholder:text-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-transparent transition"
              />
            </div>

            {/* Notes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-lighter text-brand-mid text-xs font-bold flex items-center justify-center border border-brand-light">5</span>
                <h2 className="text-base font-semibold text-brand-dark">
                  Note suplimentare{" "}
                  <span className="text-brand-mid font-normal text-sm">(optional)</span>
                </h2>
              </div>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ex. Vreau un colt de lectura, prefer pereti inchisi, am un caine mare..."
                className="w-full rounded-xl border border-brand-lighter bg-white p-3 text-sm text-brand-dark placeholder:text-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-transparent resize-none transition"
              />
            </div>

            <button
              onClick={() =>
                handleSourceProducts(style, notes, budget ? parseFloat(budget) : undefined)
              }
              className="w-full rounded-xl bg-brand-dark text-white font-semibold py-4 text-base hover:bg-[#55536A] active:scale-95 transition-all shadow-lg shadow-brand-dark/10"
            >
              Cauta Produse Reale →
            </button>
          </section>
        )}

        {/* Step 3 — Sourcing */}
        {step === "sourcing" && (
          <Spinner label="Cautam produse reale pe site-urile romanesti (eMAG, JYSK, Vivre)… 30–90 sec" />
        )}

        {/* Step 4 — Product Preview */}
        {step === "previewing" && sourcing && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-dark text-white text-xs font-bold flex items-center justify-center">✓</span>
              <h2 className="text-base font-semibold text-brand-dark">
                Produse gasite — verifica inainte de a genera
              </h2>
            </div>
            <ProductPreview
              sourcing={sourcing}
              onConfirm={handleConfirmAndRender}
              onBack={handleBackToSelecting}
              onAddCustomProduct={handleAddCustomProduct}
              onRemoveProduct={handleRemoveProduct}
              onFindMore={handleFindMoreProducts}
            />
          </section>
        )}

        {/* Step 5 — Rendering */}
        {step === "rendering" && (
          <Spinner label="Integram produsele in camera ta cu gpt-image-1… 30–60 sec per produs" />
        )}

        {/* Step 5b — Smart Replace */}
        {step === "replacing" && (
          <div className="space-y-4">
            {result && (
              <div className="overflow-hidden rounded-2xl shadow-xl opacity-40 border border-brand-lighter">
                <img
                  src={result.design_proposal.generated_image_url}
                  alt="Design curent"
                  className="w-full object-cover"
                />
              </div>
            )}
            <Spinner label="Inlocuim produsul si re-randam… 30–60 sec" />
          </div>
        )}

        {/* Step 6 — Done */}
        {step === "done" && result && (
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-brand-dark">
              Camera ta redesignata — cu produse reale
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
            <p className="text-sm font-semibold text-red-700">Ceva nu a mers bine</p>
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={reset} className="text-sm underline text-red-500 hover:text-red-700">
              Incearca din nou
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
